import { Context } from 'telegraf';
import { Message } from 'typegram';

declare module 'telegraf' {
  class Context {
    message: Message.TextMessage;
  }
}
