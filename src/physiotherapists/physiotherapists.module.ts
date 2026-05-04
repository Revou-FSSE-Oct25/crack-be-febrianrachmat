import { Module } from '@nestjs/common';
import { PhysiotherapistsController } from './physiotherapists.controller';
import { PhysiotherapistsService } from './physiotherapists.service';

@Module({
  controllers: [PhysiotherapistsController],
  providers: [PhysiotherapistsService],
})
export class PhysiotherapistsModule {}
