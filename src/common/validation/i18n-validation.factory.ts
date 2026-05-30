import { BadRequestException, ValidationError } from '@nestjs/common';
import { I18nContext } from 'nestjs-i18n';

/**
 * Translates class-validator failures using the request language. Each failed
 * constraint is keyed by its constraint name under the `validation` namespace
 * (e.g. `validation.minLength`), so every DTO is localized automatically
 * without annotating individual decorators. The original (English) constraint
 * message is used as the fallback, keeping behavior identical when no
 * translation entry or request context exists.
 */
export function buildI18nValidationException(
  errors: ValidationError[],
): BadRequestException {
  const i18n = I18nContext.current();
  const messages = collectMessages(errors, i18n, []);

  return new BadRequestException({
    message: messages.length > 0 ? messages : ['Validation failed.'],
    errorCode: 'VALIDATION_FAILED',
  });
}

function collectMessages(
  errors: ValidationError[],
  i18n: I18nContext | undefined,
  parentPath: string[],
): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const path = [...parentPath, error.property];
    const property = path.join('.');

    if (error.constraints) {
      for (const [constraintName, fallback] of Object.entries(
        error.constraints,
      )) {
        messages.push(
          translateConstraint(i18n, constraintName, property, fallback),
        );
      }
    }

    if (error.children && error.children.length > 0) {
      messages.push(...collectMessages(error.children, i18n, path));
    }
  }

  return messages;
}

function translateConstraint(
  i18n: I18nContext | undefined,
  constraintName: string,
  property: string,
  fallback: string,
): string {
  if (!i18n) {
    return fallback;
  }

  const translated = i18n.translate(`validation.${constraintName}`, {
    args: { property },
    defaultValue: fallback,
  });

  return typeof translated === 'string' ? translated : fallback;
}
