import { Context } from 'telegraf';
import { Logger } from 'tslog';

import IApiAdapter from '../adapters/types/adapter.type';
import MessageService from './message.service';
import ExchangesEnum from '../enums/exchanges.enum';
import MessagesEnum from '../enums/messages.enum';
import { IUser } from '../db/types/user.db.types';
import { HelperService } from './helper.service';
import { ApiPriceResultDto } from './dto/api-price-result.dto';

class CommandService {
  constructor(
    private readonly messageService: MessageService,
    private readonly logger: Logger,
    public readonly container: IApiAdapter[],
    private readonly helperService: HelperService,
  ) {}

  async start(ctx: Context) {
    this.logger.info(ctx.from.username);
    this.messageService.replyCustomMessage(ctx, 'Welcome !');
  }

  async getPrice(ctx: Context) {
    try {
      this.logger.info(ctx.from.username);
      const validationResult = await this.validateUserAndCurrency(ctx);
      if (!validationResult) return null;
      const { user, currency } = validationResult;

      await this.replySelectedAdaptersPrice(ctx, user, currency);
    } catch (e) {
      this.logger.error(e);
      // db error or another unexpected one
      return this.messageService.replyError(ctx);
    }
  }

  async myExchanges(ctx: Context) {
    try {
      this.logger.info(ctx.from.username);
      const user = await this.helperService.findUser(ctx.message.from.id);
      this.messageService.replySelectedExchanges(
        ctx,
        user.exchanges as ExchangesEnum[],
      );
    } catch (e) {
      this.logger.info(e);
      this.messageService.replyError(ctx);
    }
  }

  async maxPrice(ctx: Context) {
    try {
      this.logger.info(ctx.from.username);
      const validationResult = await this.validateUserAndCurrency(ctx);
      if (!validationResult) return null;
      const { user, currency } = validationResult;
      // reply selected adapters price
      await this.replySelectedAdaptersMaxPrice(ctx, user, currency);
    } catch (e) {
      this.logger.error(e);
      // db error or another unexpected one
      return this.messageService.replyError(ctx);
    }
  }

  async minPrice(ctx: Context) {
    try {
      this.logger.info(ctx.from.username);
      const validationResult = await this.validateUserAndCurrency(ctx);
      if (!validationResult) return null;
      const { user, currency } = validationResult;
      // reply selected adapters price
      await this.replySelectedAdaptersMinPrice(ctx, user, currency);
    } catch (e) {
      this.logger.error(e);
      // db error or another unexpected one
      return this.messageService.replyError(ctx);
    }
  }

  exchanges(ctx: Context) {
    this.logger.info(ctx.from.username);
    this.messageService.replyAllExchanges(ctx);
  }

  private async validateUserAndCurrency(ctx: Context) {
    const user = await this.helperService.findUser(ctx.message.from.id);
    // if not selected exchanges reply message
    if (!user.exchanges.length)
      return this.messageService.replyNotSelectedExchange(ctx);
    const currency = this.helperService.getArgumentFromCommand(ctx);
    // if not exists currency reply message
    if (!currency) return this.messageService.replyNotSelectedCurrency(ctx);
    return { user, currency };
  }

  private async replySelectedAdaptersMaxPrice(
    ctx: Context,
    user: IUser,
    currency: string,
  ) {
    const apiPriceResults = await this.getSelectedAdaptersPrice(user, currency);
    const maxPriceResult = this.findMaxPriceAdapterPriceResult(apiPriceResults);

    // response max price adapter
    this.messageService.replyCustomMessage(
      ctx,
      `${
        maxPriceResult.name
      }(HAS MAX PRICE OF SELECTED)\n${currency.toUpperCase()} - ${
        maxPriceResult.price
      } USDT`,
    );
  }

  private async replySelectedAdaptersMinPrice(
    ctx: Context,
    user: IUser,
    currency: string,
  ) {
    const apiPriceResults = await this.getSelectedAdaptersPrice(user, currency);
    const minPriceResult = this.findMinPriceAdapterPriceResult(apiPriceResults);

    // response max price adapter
    this.messageService.replyCustomMessage(
      ctx,
      `${
        minPriceResult.name
      }(HAS MIN PRICE OF SELECTED)\n${currency.toUpperCase()} - ${
        minPriceResult.price
      } USDT`,
    );
  }

  private async replySelectedAdaptersPrice(
    ctx: Context,
    user: IUser,
    currency: string,
  ): Promise<void> {
    const apiPriceResults = await this.getSelectedAdaptersPrice(user, currency);
    for (const apiPriceResult of apiPriceResults) {
      if (apiPriceResult.error) {
        this.logger.info(apiPriceResult.error);
        this.messageService.replyExchangeMessage(
          ctx,
          apiPriceResult.name,
          MessagesEnum.apiError,
        );
      } else {
        // send result
        this.messageService.replyExchangeMessage(
          ctx,
          apiPriceResult.name,
          `${apiPriceResult.price} USDT`,
        );
      }
    }
  }

  private async getSelectedAdaptersPrice(
    user: IUser,
    currency: string,
  ): Promise<ApiPriceResultDto[]> {
    const apiPriceResults: ApiPriceResultDto[] = [];
    for (const adapter of this.container) {
      // if not exists adapter, go to the next one
      if (!this.isExistsAdapter(user, adapter)) continue;
      try {
        const price = await adapter.getPrice(currency);
        apiPriceResults.push(new ApiPriceResultDto(adapter.name, price, false));
      } catch (e) {
        this.logger.error(e);
        //  an axios error (means that the currency is wrong or not exists in this exchange)
        apiPriceResults.push(new ApiPriceResultDto(adapter.name, 0, true));
      }
    }
    return apiPriceResults;
  }

  private isExistsAdapter(user: IUser, adapter: IApiAdapter) {
    return user.exchanges.find(
      (name) => name.toUpperCase() === adapter.name.toUpperCase(),
    );
  }

  private findMaxPriceAdapterPriceResult(
    apiPriceResults: ApiPriceResultDto[],
  ): ApiPriceResultDto {
    let maxPriceResult: ApiPriceResultDto = apiPriceResults[0];
    for (let i = 1; i < apiPriceResults.length; i++) {
      const curAdapter = apiPriceResults[i];
      if (maxPriceResult.price < curAdapter.price) {
        maxPriceResult = curAdapter;
      }
    }
    return maxPriceResult;
  }

  private findMinPriceAdapterPriceResult(
    apiPriceResults: ApiPriceResultDto[],
  ): ApiPriceResultDto {
    let maxPriceResult: ApiPriceResultDto = apiPriceResults[0];
    for (let i = 1; i < apiPriceResults.length; i++) {
      const curAdapter = apiPriceResults[i];
      if (maxPriceResult.price > curAdapter.price) {
        maxPriceResult = curAdapter;
      }
    }
    return maxPriceResult;
  }
}

export default CommandService;
