import { Logger, Module, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { createConfigurableDynamicRootModule } from '@golevelup/nestjs-modules';
import { IMQConfig, IMQDecoratorOptions, MQObjectType } from './interfaces/mq.interfaces';
import { IBM_MQ_ARGS_METADATA, IBM_MQ_CONFIG_TOKEN, IBM_MQ_HANDLER } from './constants/mq.constants';
import { IbmMqConnectionManager } from './ibm-mq/ibm-mq.connection-manager';
import { IbmMqConnection } from './ibm-mq/ibm-mq.connection';
import { DiscoveryModule, DiscoveryService } from '@golevelup/nestjs-discovery';
import { ExternalContextCreator } from '@nestjs/core/helpers/external-context-creator';
import { groupBy } from 'lodash';
import { IbmMqConnectionFactory, IbmMqParamsFactory } from './factories/mq.factory';
import { ClosePromise } from 'ibmmq';

@Module({
  imports: [DiscoveryModule],
  providers: [],
  exports: [],
})
export class IbmMqNestModule
  extends createConfigurableDynamicRootModule<IbmMqNestModule, IMQConfig>(IBM_MQ_CONFIG_TOKEN, {
    providers: [
      {
        provide: IbmMqConnectionManager,
        useFactory: async (config: IMQConfig, conn: IbmMqConnectionFactory) => {
          const con: IbmMqConnection = await conn.createConnection(config.channel, config.credentials, config.options);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.IbmMqNestModule.connectionManager.addConnection(con);
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return this.IbmMqNestModule.connectionManager;
        },
        inject: [IBM_MQ_CONFIG_TOKEN, IbmMqConnectionFactory],
      },
      {
        provide: IbmMqConnection,
        useFactory: async (config: IMQConfig): Promise<IbmMqConnection> => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return this.IbmMqNestModule.connectionManager.getConnection(
            config.channel.queueManager.name,
          ) as IbmMqConnection;
        },
        inject: [IBM_MQ_CONFIG_TOKEN, IbmMqConnectionManager],
      },
      IbmMqParamsFactory,
      IbmMqConnectionFactory,
    ],
    exports: [IbmMqConnectionManager, IbmMqConnection],
  })
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(IbmMqNestModule.name);
  private static connectionManager = new IbmMqConnectionManager();
  private static bootstrapped = false;

  constructor(
    private readonly discover: DiscoveryService,
    private readonly externalContextCreator: ExternalContextCreator,
    private readonly connectionManager: IbmMqConnectionManager,
    private readonly ibmMqParamsFactory: IbmMqParamsFactory,
  ) {
    super();
  }

  async onApplicationShutdown(signal?: string) {
    this.logger.verbose('Closing IBM MQ Connections');
    const connections = this.connectionManager.getConnections();
    const closeQueuesOpenedPromises: Promise<void>[] = [];
    connections.forEach((connection) => {
      const objectNamesGetMessages = Object.keys(connection.objectsOpenedToGetMessages);
      for (const queueName of objectNamesGetMessages) {
        closeQueuesOpenedPromises.push(ClosePromise(connection.objectsOpenedToGetMessages[queueName], 0));
      }
    });
    await Promise.all(closeQueuesOpenedPromises);

    await Promise.all(this.connectionManager.getConnections().map((connection) => connection.closeConnection()));

    this.connectionManager.clearConnections();
    IbmMqNestModule.bootstrapped = false;
  }

  async onApplicationBootstrap() {
    if (IbmMqNestModule.bootstrapped) {
      return;
    }
    IbmMqNestModule.bootstrapped = true;
    const connections = this.connectionManager.getConnections();
    this.logger.log('Initializing IBM MQ Handlers');
    this.logger.log(
      'Searching for MQ Handlers in Controllers. You can not use NestJS HTTP-Requests in these controllers!',
    );
    let mqMetas = await this.discover.providerMethodsWithMetaAtKey<IMQDecoratorOptions>(IBM_MQ_HANDLER);
    mqMetas = mqMetas.concat(await this.discover.controllerMethodsWithMetaAtKey<IMQDecoratorOptions>(IBM_MQ_HANDLER));
    for (const connection of connections) {
      const metasUsingThisConnection = mqMetas;
      const mqMetasGrouped = groupBy(metasUsingThisConnection, (x) => x.discoveredMethod.parentClass.name);
      const providerKeys = Object.keys(mqMetasGrouped);

      for (const providerKey of providerKeys) {
        this.logger.log(`Registering IBM MQ handlers from ${providerKey}`);
        await Promise.all(
          mqMetasGrouped[providerKey].map(async ({ discoveredMethod, meta }) => {
            const handler = this.externalContextCreator.create(
              discoveredMethod.parentClass.instance,
              discoveredMethod.handler,
              discoveredMethod.methodName,
              IBM_MQ_ARGS_METADATA,
              this.ibmMqParamsFactory,
              undefined, // contextId
              undefined, // inquirerId
              undefined, // options
              'ibm-mq',
            );
            const handlerDisplayName = `${discoveredMethod.parentClass.name} -> ${discoveredMethod.methodName} -> ${meta.targetType} -> ${meta.targetName}}`;
            this.logger.log(handlerDisplayName);
            const handlerName = meta.targetName;
            const handlerObj = {};
            const mergedConfig = {
              ...meta,
              ...handlerObj[handlerName],
            };
            return meta.targetType === MQObjectType.TOPIC
              ? connection.createTopicSubscriber(handler, mergedConfig, discoveredMethod.methodName)
              : connection.createQueueSubscriber(handler, mergedConfig, discoveredMethod.methodName);
          }),
        );
      }
    }
  }
}
