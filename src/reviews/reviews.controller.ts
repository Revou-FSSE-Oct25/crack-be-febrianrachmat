import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@ApiBearerAuth('access-token')
@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Roles(UserRole.PATIENT)
  @Post('reviews')
  @ApiOperation({
    summary: 'Create review for completed booking or consultation',
  })
  createReview(@Req() req: Request, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(req.user as AuthUser, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('reviews/me')
  @ApiOperation({ summary: 'List reviews by current actor' })
  listMyReviews(@Req() req: Request, @Query() query: PaginationQueryDto) {
    return this.reviewsService.listMyReviews(req.user as AuthUser, query);
  }

  @Roles(UserRole.ADMIN, UserRole.PATIENT, UserRole.PHYSIOTHERAPIST)
  @Get('physiotherapists/:physiotherapistId/reviews')
  @ApiOperation({ summary: 'List public reviews for physiotherapist' })
  listPublicReviews(
    @Param('physiotherapistId') physiotherapistId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reviewsService.listPublicReviewsByPhysiotherapist(
      physiotherapistId,
      query,
    );
  }

  @Roles(UserRole.PATIENT)
  @Patch('reviews/:reviewId')
  @ApiOperation({ summary: 'Update own review (rating and/or comment)' })
  updateMyReview(
    @Req() req: Request,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.updateMyReview(
      req.user as AuthUser,
      reviewId,
      dto,
    );
  }

  @Roles(UserRole.PATIENT)
  @Delete('reviews/:reviewId')
  @ApiOperation({ summary: 'Delete own review' })
  deleteMyReview(@Req() req: Request, @Param('reviewId') reviewId: string) {
    return this.reviewsService.deleteMyReview(req.user as AuthUser, reviewId);
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/reviews/:reviewId/moderate')
  @ApiOperation({ summary: 'Moderate review visibility (admin)' })
  moderateReview(
    @Req() req: Request,
    @Param('reviewId') reviewId: string,
    @Body() dto: ModerateReviewDto,
  ) {
    return this.reviewsService.moderateReview(
      req.user as AuthUser,
      reviewId,
      dto,
    );
  }
}
