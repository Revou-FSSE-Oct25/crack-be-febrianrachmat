import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PhysiotherapistsController } from './physiotherapists.controller';
import { PhysiotherapistsService } from './physiotherapists.service';

@Module({
  imports: [NotificationsModule],
  controllers: [PhysiotherapistsController],
  providers: [PhysiotherapistsService],
})
export class PhysiotherapistsModule {}
