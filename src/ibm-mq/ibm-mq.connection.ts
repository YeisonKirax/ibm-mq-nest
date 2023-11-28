import {Logger, LoggerService} from '@nestjs/common';
import {catchError, lastValueFrom, Subject, take, throwError, timeout,} from 'rxjs';
import {
  ClosePromise,
  ConnxPromise,
  Get,
  GetDone,
  MQC,
  MQCD,
  MQCNO,
  MQCSP,
  MQError,
  MQGMO,
  MQMD,
  MQObject,
  MQOD,
  MQPMO,
  MQQueueManager,
  MQSD,
  OpenPromise,
  PutPromise,
  setTuningParameters,
  SubPromise,
} from '@yeisonkirax/ibm-mq';
import {StringDecoder} from 'string_decoder';
import {v4 as generateUUID} from 'uuid';
import {isNotEmpty} from 'class-validator';
import {IMQChannel, IMQCredentials, IMQDecoratorOptions, IMQOptions, MQObjectType,} from '../interfaces/mq.interfaces';

const decoder = new StringDecoder('utf8');

export type ConsumerTag = string;

/**
 * `AdditionalInfo` is an object with a `correlationId` property of type
 * `string`, a `msgId` property of type `string`, a `rawMessage` property of
 * type `Buffer`, and a `messageDescriptor` property of type `MQMD`.
 *
 * The `MQMD` type is defined in the `mq-types` module.
 * @property {string} correlationId - The correlation ID of the message.
 * @property {string} msgId - The message ID of the message that was received.
 * @property {Buffer} rawMessage - The raw message buffer.
 * @property {MQMD} messageDescriptor - This is the MQMD object that is
 *   returned by the MQI call.
 */
export type AdditionalInfo = {
  correlationId: string;
  msgId: string;
  rawMessage: Buffer;
  messageDescriptor: MQMD;
};
export type SubscriberHandler = (
  msg: any,
  additionalInfo?: Partial<AdditionalInfo>,
) => Promise<void>;

export type BaseConsumerHandler = {
  consumerTag: string;
};

export declare type TopicOptions = {
  type: MQObjectType.TOPIC;
  name: string;
};

export declare type QueueOptions = {
  type: MQObjectType.QUEUE;
  name: string;
};

/**
 * `PublishMessageOptions` is an object with a `target` property that is either
 * a
 * `TopicOptions` or a `QueueOptions` object, and an optional `replyToQueue`
 * property.
 * @property {TopicOptions | QueueOptions} target - The target topic or queue
 *   to publish the message to.
 * @property {Buffer} [messageId] - The message id to send.
 * @property {Buffer} [correlativeId] - The correlative id to send.
 * @property {string} replyToQueue - The name of the queue to which the service
 * should send the reply.
 */
export type PublishMessageOptions = {
  /** The target topic or queue to publish the message to */
  target: TopicOptions | QueueOptions;

  /** The message id to send */
  messageId?: Buffer;

  /** The correlative id to send */
  correlativeId?: Buffer;

  /** The name of the queue to which the service should send the reply. */
  replyToQueue?: string;
};

/** Defining a type for the GetMessagesConfig object.
 * @property {QueueOptions} queue - The queue where will get the messages.
 * @property {boolean} filterMessagesById - Enable the filter to get
 * messages by id. If is false, you will not filter the messages.
 * @property {Buffer} [msgId] - The msg id used to filter. If you enable
 * "filterMessagesById", this value must be provided.
 * @property {number} waitInterval - The time in ms that you will wait for
 * the response.
 */
export declare type GetMessagesConfig = {
  /**
   * The queue where will get the messages.
   */
  queue: QueueOptions;

  /**
   * Enable the filter to get messages by id. If is false, you will not
   * filter the messages.
   */
  filterMessagesById: boolean;

  /**
   * The msg id used to filter. If you enable "filterMessagesById", this
   * value must be provided.
   */
  msgId?: Buffer;

  /**
   * The time in ms that you will wait for the messages.
   */
  waitInterval: number;
};

export type ConsumerHandler<T, U> =
  | BaseConsumerHandler & {
  type: MQObjectType;
  targetName: string;
  handler: (msg: T | string, additionalInfo: AdditionalInfo) => Promise<U>;
};

export class IbmMqConnection {
  private logger: LoggerService;
  private readonly mqChannel: Required<IMQChannel>;
  private readonly mqOptions: IMQOptions;

  private initialized$ = new Subject<void>();
  private _managedConnection: MQQueueManager;
  private _mqObjectsOpenedToGetMessages: Record<string, MQObject> = {};
  private _consumers: Record<ConsumerTag, ConsumerHandler<unknown, unknown>> =
    {};

  constructor(
    private readonly channel: IMQChannel,
    private readonly credentials: IMQCredentials,
    private readonly options: IMQOptions,
  ) {
    this.mqChannel = {
      ...this.channel,
    };
    this.mqOptions = {...this.options};
    this.logger = new Logger(IbmMqConnection.name);
  }

  get getMqChannel() {
    return this.mqChannel;
  }

  get consumers() {
    return this._consumers;
  }

  get managedConnection(): MQQueueManager {
    return this._managedConnection;
  }

  get objectsOpenedToGetMessages(): Record<string, MQObject> {
    return this._mqObjectsOpenedToGetMessages;
  }

  /**
   * It initializes the core of the library, and if the caller doesn't want to
   * wait for the initialization to complete, it returns a promise that will
   * resolve when the initialization is complete. If the caller does want to
   * wait for the initialization to complete, it returns a promise that will
   * resolve when the initialization is complete, or reject if the
   * initialization takes longer than
   * 10 seconds
   * @returns A promise that resolves when the connection is established.
   */
  public async init(): Promise<void> {
    const wait = false;
    const p = this.initCore();
    if (!wait) return p;

    return lastValueFrom(
      this.initialized$.pipe(
        take(1),
        timeout({
          each: 10 * 1000,
          with: () =>
            throwError(
              () =>
                new Error(
                  `Failed to connect to a IBM MQ broker within a timeout of ${10}s`,
                ),
            ),
        }),
        catchError((err) => throwError(() => err)),
      ),
    );
  }

  /**
   * It creates a connection descriptor, a connection options object, and then
   * uses the `ConnxPromise` function to connect to the queue manager
   */
  private async initCore() {
    const queueManager = this.getMqChannel.queueManager;
    this.logger.log(
      `Trying to connect to IBM MQ Broker ${queueManager.name}-${this.getMqChannel.name}`,
    );
    const connectionDescriptor = new MQCD();
    connectionDescriptor.ConnectionName = `${queueManager.host}(${queueManager.port})`;
    connectionDescriptor.ChannelName = this.mqChannel.name;

    const connectionOptions = new MQCNO();

    if (isNotEmpty(this.credentials)) {
      const securityParams = new MQCSP();
      securityParams.UserId = this.credentials.userId;
      securityParams.Password = this.credentials.password;
      connectionOptions.SecurityParms = securityParams;
    }

    connectionOptions.Options = MQC.MQCNO_CLIENT_BINDING;
    connectionOptions.ClientConn = connectionDescriptor;

    this._managedConnection = await ConnxPromise(
      queueManager.name,
      connectionOptions,
    );
    const {getLoopPollTimeMs, getLoopDelayTimeMs, maxConsecutiveGets, debug} =
      this.mqOptions;

    setTuningParameters({
      getLoopPollTimeMs: getLoopPollTimeMs ?? 1000 * 10,
      getLoopDelayTimeMs: getLoopDelayTimeMs ?? 1000 * 3,
      maxConsecutiveGets: maxConsecutiveGets ?? 1,
      debugLog: debug || false,
    });

    this.logger.log(
      `Successfully connected to MQ broker (${queueManager.name}-${this.getMqChannel.name})`,
    );
  }

  /**
   * It takes a consumer and adds it to the consumers object
   * @param consumer - ConsumerHandler<T, U>
   */
  private registerConsumerForQueue<T, U>(consumer: ConsumerHandler<T, U>) {
    (this._consumers as Record<ConsumerTag, ConsumerHandler<T, U>>)[
      consumer.consumerTag
      ] = consumer;
  }

  /**
   * It creates a subscription to a topic, registers a consumer for the topic,
   * and then starts listening for messages on the topic
   * @param {SubscriberHandler} handler - SubscriberHandler - The handler
   *   function that will be called when a message is received.
   * @param {TopicOptions} topicOptions - TopicOptions
   * @param {string} originalHandlerName - The name of the handler function
   */
  public async createTopicSubscriber(
    handler: SubscriberHandler,
    topicOptions: IMQDecoratorOptions,
    originalHandlerName: string,
  ): Promise<void> {
    this.logger.log(
      `Creating Subscription to topic ${topicOptions.targetName}`,
    );
    const topic = topicOptions.targetName;
    const mqSubscriptorDescriptor = new MQSD();
    mqSubscriptorDescriptor.ObjectString = topic;
    mqSubscriptorDescriptor.SubName = `MS-${generateUUID()}`;
    mqSubscriptorDescriptor.Options =
      MQC.MQSO_CREATE |
      MQC.MQSO_NON_DURABLE |
      MQC.MQSO_FAIL_IF_QUIESCING |
      MQC.MQSO_MANAGED;

    const topicSubscribed = await SubPromise(
      this.managedConnection,
      null,
      mqSubscriptorDescriptor,
    );
    const mqmd = new MQMD();
    const gmo = new MQGMO();
    //gmo.WaitInterval = 3 * 1000; // 3 seconds
    gmo.Options =
      MQC.MQGMO_NO_SYNCPOINT |
      MQC.MQGMO_CONVERT |
      MQC.MQGMO_FAIL_IF_QUIESCING |
      MQC.MQGMO_NO_WAIT;

    gmo.MatchOptions = MQC.MQMO_NONE;

    this.registerConsumerForQueue({
      type: MQObjectType.TOPIC,
      consumerTag: `${topicOptions.targetName}${originalHandlerName}`,
      handler,
      targetName: topicOptions.targetName,
    });
    this.logger.log(`Subscribed to topic ${topicOptions.targetName}`);

    Get(
      topicSubscribed.hObj,
      mqmd,
      gmo,
      (err: MQError, hObj: MQObject, gmo: MQGMO, md: MQMD, buf: Buffer) => {
        if (err) {
          this.handleError(handler, err);
        }

        this.handleMessage(handler, buf, md);
      },
    );
  }

  /**
   * It opens a queue, creates a Get function, and registers the consumer
   * @param {SubscriberHandler} handler - The handler function that will be
   *   called when a message is received.
   * @param {QueueOptions} queueOptions - QueueOptions
   * @param {string} originalHandlerName - The name of the handler that was
   *   passed in.
   */
  public async createQueueSubscriber(
    handler: SubscriberHandler,
    queueOptions: IMQDecoratorOptions,
    originalHandlerName: string,
  ): Promise<void> {
    this.logger.log(
      `Creating Subscription to queue ${queueOptions.targetName}`,
    );
    const queue = queueOptions.targetName;
    const queueDescriptor = new MQOD();
    queueDescriptor.ObjectName = queue;
    queueDescriptor.ObjectType = MQC.MQOT_Q;
    const openQueueOptions = [MQC.MQOO_INPUT_AS_Q_DEF];
    const queueOpened = await OpenPromise(
      this.managedConnection,
      queueDescriptor,
      openQueueOptions,
    );
    this.objectsOpenedToGetMessages[queue] = queueOpened;
    const mqmd = new MQMD();
    const gmo = new MQGMO();
    gmo.Options = [
      MQC.MQGMO_NO_WAIT,
      MQC.MQGMO_NO_SYNCPOINT,
      MQC.MQGMO_CONVERT,
      MQC.MQGMO_FAIL_IF_QUIESCING,
    ];

    gmo.MatchOptions = MQC.MQMO_NONE;

    Get(
      queueOpened,
      mqmd,
      gmo,
      (err: MQError, hObj: MQObject, gmo: MQGMO, md: MQMD, buf: Buffer) => {
        if (err) {
          this.handleError(handler, err);
        }
        this.handleMessage(handler, buf, md);
      },
    );

    this.registerConsumerForQueue({
      type: MQObjectType.QUEUE,
      consumerTag: `${queueOptions.targetName}/${originalHandlerName}`,
      handler,
      targetName: queueOptions.targetName,
    });
    this.logger.log(`Subscribed to queue ${queueOptions.targetName}`);
  }

  /**
   * It opens a queue or topic, puts a message on it, and closes the queue or
   * topic
   * @param {string} message - The message to be sent.
   * @param {PublishMessageOptions} msgOptions - PublishMessageOptions
   * @returns The return value is a Promise that resolves with the msg id.
   */
  public async publish(
    message: string,
    msgOptions: PublishMessageOptions,
  ): Promise<{ msgId: Buffer }> {
    const objectName = msgOptions.target.name;
    const mqObjectType = msgOptions.target.type;
    const openDescriptor = new MQOD();
    if (mqObjectType === MQObjectType.TOPIC) {
      openDescriptor.ObjectString = objectName;
      openDescriptor.ObjectType = MQC.MQOT_TOPIC;
    } else if (mqObjectType === MQObjectType.QUEUE) {
      openDescriptor.ObjectName = objectName;
      openDescriptor.ObjectType = MQC.MQOT_Q;
    }
    const openOptions = MQC.MQOO_OUTPUT;

    const objectOpened = await OpenPromise(
      this.managedConnection,
      openDescriptor,
      openOptions,
    );

    const messageDescriptor = new MQMD();
    if (isNotEmpty(msgOptions.replyToQueue))
      messageDescriptor.ReplyToQ = msgOptions.replyToQueue;
    if (
      isNotEmpty(msgOptions.messageId) &&
      isNotEmpty(msgOptions.correlativeId)
    ) {
      messageDescriptor.MsgId = msgOptions.messageId;
      messageDescriptor.CorrelId = msgOptions.correlativeId;
    }
    const putMessageOptions = new MQPMO();
    putMessageOptions.Options =
      MQC.MQPMO_NO_SYNCPOINT | MQC.MQPMO_NEW_MSG_ID | MQC.MQPMO_NEW_CORREL_ID;
    if (mqObjectType === MQObjectType.TOPIC) {
      putMessageOptions.Options |= MQC.MQPMO_WARN_IF_NO_SUBS_MATCHED;
    }

    await PutPromise(
      objectOpened,
      messageDescriptor,
      putMessageOptions,
      message,
    );
    await ClosePromise(objectOpened, 0);
    return {msgId: messageDescriptor.MsgId};
  }

  /**
   * Get the messages from a queue.
   * @param {GetMessagesConfig} options - The message to be sent.
   * @returns The return a Promise that resolves with the msg as string or
   * an error.
   */
  public async getMessagesFromQueue(
    options: GetMessagesConfig,
  ): Promise<string> {
    const queue = options.queue.name;
    const queueDescriptor = new MQOD();
    queueDescriptor.ObjectName = queue;
    queueDescriptor.ObjectType = MQC.MQOT_Q;
    const openQueueOptions = [MQC.MQOO_INPUT_AS_Q_DEF];
    const queueOpened = await OpenPromise(
      this.managedConnection,
      queueDescriptor,
      openQueueOptions,
    );
    const mqmd = new MQMD();
    const gmo = new MQGMO();

    gmo.WaitInterval = options.waitInterval;

    gmo.Options = [
      MQC.MQGMO_WAIT,
      MQC.MQGMO_NO_SYNCPOINT,
      MQC.MQGMO_CONVERT,
      MQC.MQGMO_FAIL_IF_QUIESCING,
    ];

    if (options.filterMessagesById && isNotEmpty(options.msgId)) {
      gmo.MatchOptions = MQC.MQMO_MATCH_MSG_ID;
      mqmd.MsgId = options.msgId;
    } else {
      gmo.MatchOptions = MQC.MQMO_NONE;
    }
    return new Promise((resolve, reject) => {
      Get(
        queueOpened,
        mqmd,
        gmo,
        (err: MQError, hObj: MQObject, gmo: MQGMO, md: MQMD, buf: Buffer) => {
          if (err) {
            if (err.mqrc == MQC.MQRC_NO_MSG_AVAILABLE) {
              console.log('No more messages available.');
            }
            GetDone(hObj);
            return reject(err);
          }
          const message: string =
            md.Format == 'MQSTR' ? decoder.write(buf) : buf.toString();
          GetDone(hObj);
          return resolve(message);
        },
      );
    });
  }

  private handleError(handler: SubscriberHandler, error: MQError) {
    if (error.mqrc == MQC.MQRC_NO_MSG_AVAILABLE) {
      console.log('No more messages available.');
    }
    return this.handleMessage(handler, null, null, error);
  }

  private handleMessage(
    handler: (
      msg: string | undefined,
      additionalInfo: AdditionalInfo,
      error?: MQError,
    ) => Promise<void>,
    rawMsg: Buffer,
    messageDescriptor: MQMD,
    error?: MQError,
  ) {
    if (error) {
      return handler(
        null,
        {
          msgId: null,
          correlationId: null,
          rawMessage: null,
          messageDescriptor: null,
        },
        error,
      );
    }
    let message: string;
    if (messageDescriptor.Format == 'MQSTR') {
      message = decoder.write(rawMsg);
    } else {
      message = rawMsg.toString();
    }
    const correlationId = this.toHexString(messageDescriptor.CorrelId);
    const msgId = this.toHexString(messageDescriptor.MsgId);

    return handler(message, {
      msgId,
      correlationId,
      rawMessage: rawMsg,
      messageDescriptor,
    });
  }

  public closeConnection() {
    return ClosePromise(this.managedConnection, 0);
  }

  private toHexString(byteArray: Buffer) {
    return byteArray.reduce(
      (output, elem) => output + ('0' + elem.toString(16)).slice(-2),
      '',
    );
  }

  public hexToBytes(hex: string): number[] {
    const bytes: number[] = [];
    for (let c = 0; c < hex.length; c += 2)
      bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
  }
}
