import { Module } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsController } from './communications.controller';
import { SmsService } from './sms.service';
import { EmailService } from './email.service';
import { NotificationService } from './notification.service';
import { ConsentService } from './consent.service';

@Module({
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    SmsService,
    EmailService,
    NotificationService,
    ConsentService,
  ],
  exports: [CommunicationsService, NotificationService, ConsentService],
})
export class CommunicationsModule {}
