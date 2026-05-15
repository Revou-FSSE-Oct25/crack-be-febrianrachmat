declare module 'passport-apple' {
  import { Strategy as PassportStrategy } from 'passport-strategy';

  export class Strategy extends PassportStrategy {
    constructor(
      options: {
        clientID: string;
        teamID: string;
        keyID: string;
        privateKeyString: string;
        callbackURL: string;
        scope?: string[];
        passReqToCallback?: boolean;
      },
      verify: (
        req: unknown,
        accessToken: string,
        refreshToken: string,
        idToken: string,
        profile: {
          id: string;
          email?: string;
          name?: { firstName?: string; lastName?: string };
        },
        done: (error: unknown, user?: unknown) => void,
      ) => void,
    );
  }
}
