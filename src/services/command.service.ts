import ICommandService from './types/command.service.type';
import { Context } from 'telegraf';
import IApiAdapter from '../adapters/types/adapter.type';
import UserSchema, { IUser } from '../schemas/user.schema';
import MessageService from './message.service';
import ExchangesEnum from '../enums/exchanges.enum';
import { AxiosError } from 'axios';
import MessagesEnum from '../enums/messages.enum';

class CommandService implements ICommandService {
  container: IApiAdapter[];

  constructor(
    private readonly messageService: MessageService,
    apiAdapters: IApiAdapter[],
  ) {
    this.container = apiAdapters;
  }
  async start(ctx: Context) {
    try {
      const exists = await UserSchema.findOne({
        telegram_id: ctx.message.from.id,
      });
      if (!exists) {
        await UserSchema.create({
          telegram_id: ctx.message.from.id,
          telegram_lang: ctx.message.from.language_code,
          is_bot: ctx.message.from.is_bot,
          telegram_name: ctx.message.from.username,
        });
      }
      ctx.reply('Welcome!');
    } catch (e) {
      ctx.reply('Error!');
    }
  }
  async getPrice(ctx: Context & { message: { text: string } }) {
    try {
      const user = await this.findUser(ctx.message.from.id);
      // if not selected exchanges reply message
      if (!user.exchanges.length)
        return this.messageService.replyNotSelectedExchange(ctx);

      const currency = this.getArgumentFromCommand(ctx);
      console.log(currency);
      // if not exists currency reply message
      if (!currency) return this.messageService.replyNotSelectedCurrency(ctx);

      // reply selected adapters price
      for (const adapter of this.container) {
        if (user.exchanges.includes(adapter.name)) {
          const price = await adapter.getPrice(currency);
          ctx.reply(
            `${adapter.name}\n${currency.toUpperCase()} - ${price} USDT`,
          );
        }
      }
    } catch (e) {
      if (e instanceof AxiosError)
        return this.messageService.replyCustomMessage(
          ctx,
          MessagesEnum.apiError,
        );
      this.messageService.replyError(ctx);
    }
  }
  exchanges(ctx: Context) {
    this.messageService.replyAllExchanges(ctx);
  }
  async myExchanges(ctx: Context) {
    try {
      const user = await this.findUser(ctx.message.from.id);
      this.messageService.replySelectedExchanges(
        ctx,
        user.exchanges as ExchangesEnum[],
      );
    } catch (e) {
      this.messageService.replyError(ctx);
    }
  }
  private async findUser(telegramId: number): Promise<IUser> {
    return UserSchema.findOne({ telegram_id: telegramId });
  }
  private getArgumentFromCommand(ctx: Context & { message: { text: string } }) {
    return ctx.message.text.replace(/\s\s+/g, ' ').split(' ')[1];
  }
  private getExchangeFromCallBack(ctx: Context) {
    return ctx.callbackQuery.data?.split('-')?.at(-1)?.toUpperCase();
  }
  async setExchange(ctx: Context) {
    try {
      const selectedExchange = this.getExchangeFromCallBack(
        ctx,
      ) as ExchangesEnum;
      if (!selectedExchange) throw new Error();
      const user: IUser = await this.findUser(ctx.callbackQuery.from.id);
      // check is already selected the exchange
      if (
        user.exchanges.find((elem) => elem.toUpperCase() === selectedExchange)
      ) {
        return this.messageService.replyAlreadySelectedExchange(
          ctx,
          selectedExchange,
        );
      }
      // add exchange to the user's exchanges
      await UserSchema.updateOne(
        { telegram_id: user.telegram_id },
        { $push: { exchanges: selectedExchange } },
      );
      this.messageService.replySelectedExchange(ctx, selectedExchange);
    } catch (e) {
      this.messageService.replyError(ctx);
    }
  }
  async removeExchange(ctx: Context) {
    try {
      const selectedExchange = this.getExchangeFromCallBack(
        ctx,
      ) as ExchangesEnum;
      if (!selectedExchange) throw new Error();
      const user: IUser = await this.findUser(ctx.callbackQuery.from.id);
      if (
        !user.exchanges.find((elem) => elem.toUpperCase() === selectedExchange)
      )
        return this.messageService.replyCustomMessage(
          ctx,
          `You cannot delete ${selectedExchange} because you did not selected it.`,
        );

      await UserSchema.updateOne(
        { telegram_id: user.telegram_id },
        { $pull: { exchanges: selectedExchange.toUpperCase() } },
      );
      this.messageService.replyRemovedExchange(ctx, selectedExchange);
    } catch (e) {
      this.messageService.replyError(ctx);
    }
  }
}

export default CommandService;
