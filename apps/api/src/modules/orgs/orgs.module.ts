import { Module } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';
import { ProsController } from './pros.controller';
import { ProsService } from './pros.service';

@Module({
  controllers: [OrgsController, ProsController],
  providers: [OrgsService, ProsService],
  exports: [OrgsService, ProsService],
})
export class OrgsModule {}
