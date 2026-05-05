import { Module } from '@nestjs/common';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { AvailabilitySlotsService } from './availability-slots.service';

@Module({
  controllers: [AvailabilitySlotsController],
  providers: [AvailabilitySlotsService],
})
export class AvailabilitySlotsModule {}
