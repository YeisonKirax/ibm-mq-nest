import { IMQDecoratorOptions, IMQMessageHandler, MQObjectType } from '../interfaces/mq.interfaces';
import { applyDecorators, SetMetadata } from '@nestjs/common';
import { makeInjectableDecorator } from '@golevelup/nestjs-common';
import { IBM_MQ_CONFIG_TOKEN, IBM_MQ_HANDLER } from '../constants/mq.constants';

/**
 * It takes an object of type T, which is a subset of IMQHandlerConfig, and
 * returns a function that takes an object of type Pick<IMQHandlerConfig,
 * Exclude<keyof IMQHandlerConfig, keyof T>>, which is a subset of
 * IMQHandlerConfig that excludes the properties of T
 * @param {T} input - T - This is the input parameter that you will pass
 * to the
 * decorator.
 */
export const makeIBMMQDecorator =
  <T extends Partial<IMQDecoratorOptions>>(input: T) =>
  (config: Pick<IMQDecoratorOptions, Exclude<keyof IMQDecoratorOptions, keyof T>>) =>
    applyDecorators(SetMetadata(IBM_MQ_HANDLER, { ...input, ...config }));

/* A decorator that is used to subscribe to a topic or queue. */
export const MQHandler = (config: IMQMessageHandler) => (target, key, descriptor) =>
  SetMetadata(IBM_MQ_HANDLER, config)(target, key, descriptor);

/* A decorator that is used to subscribe to a topic. */
export const MQTopicSubscribe = makeIBMMQDecorator({
  targetType: MQObjectType.TOPIC,
});
/* A decorator that is used to subscribe to a queue. */
export const MQQueueSubscribe = makeIBMMQDecorator({
  targetType: MQObjectType.QUEUE,
});
export const InjectMQConfig = makeInjectableDecorator(IBM_MQ_CONFIG_TOKEN);
