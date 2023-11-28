# @yeisonkirax/ibm-mq-nest

# Table of Contents

- [@yeisonkirax/ibm-mq-nest](#yeisonkiraxibm-mq-nest)
- [Table of Contents](#table-of-contents)
    - [Description](#description)
    - [Requirements](#requirements)
    - [Usage](#usage)
        - [Module Initialization](#module-initialization)
    - [Usage with Interceptors, Guards and Filters](#usage-with-interceptors-guards-and-filters)
    - [Usage with Controllers](#usage-with-controllers)
    - [Receiving Messages](#receiving-messages)
        - [Dealing with the original message](#dealing-with-the-original-message)
    - [Sending Messages](#sending-messages)
        - [Inject the IbmMqConnection](#inject-the-IbmMqConnection)
        - [Publishing Messages](#publishing-Messages)
        - [Waiting for a response](#waiting-for-a-response)

## Description

Inspired
by [@golevelup/nestjs-rabbitmq](https://www.npmjs.com/package/@golevelup/nestjs-rabbitmq)
package, i made this module to integrate ibm queues into our nest
applications. This module use a fork of
[ibmmq](https://www.npmjs.com/package/ibmmq), that permit to subscribe to
multiples queues without block the application.

## Requirements

It is important that you have made the configuration requested by the ibmmq.
You must set up:

* Node version 10.20 or greater. Older versions will no longer work because
  of requirements from the ffi-napi package.
* On platforms other than Windows and Linux x64, you must also install the
  MQ client package.
* The package makes use of the libffi capabilities for direct access to the
  MQ API. For some platforms the libffi and ffi-napi components may need
  additional configuration before they can be build. That package is not
  available at all on z/OS - there is no way that this package can run on that
  platform even with handcrafting build steps.

To see the requirements with more details, please refer
to [ibmmq](https://www.npmjs.com/package/ibmmq)

## Usage

### Module Initialization

You must import and add `IbmMqNestModule` in you appModule and set up the
connection. For now, you can only connect to one queueManager per application.

```typescript
import {IbmMqNestModule} from '@yeisonkirax/ibm-mq-nest';

@Module({
  imports: [IbmMqNestModule.forRoot(IbmMqNestModule, {
    channel: {
      name: "channel name", queueManager: {
        name: "queueManager name",
        host: "the queueManager's url",
        port: "the queueManager's port",
      },
    }, credentials: {
      userId: 'usedId', password: 'password',
    },
  })], controllers: [AppController], providers: [],
})
export class AppModule {
}
```

The parameters that the module receives for its configuration correspond to
the following structure:

```typescript
/**
 * Defining the interface for the credentials' config.
 * @property {string} userId - User's id that can connect to the queueManager.
 * @property {string} password - User's password that can connect to the
 *   queueManager
 */
export interface IMQCredentials {
  /** User's id that can connect to the queueManager **/
  userId: string;

  /** User's password that can connect to the queueManager **/
  password: string;
}

/**
 * Defining the interface for the queueManager.
 * @property {string} name - The name of the queueManager.
 * @property {string} host - The host of the queueManager.
 * @property {string} port - The port of the queueManager.
 */
export interface IMQQueueManager {
  /** The name of the queueManager **/
  name: string;

  /** The host of the queueManager **/
  host: string;

  /** The port of the queueManager **/
  port: string;
}

/**
 * Defining the interface for the channel.
 * @property {string} name - The name of the channel.
 * @property {IMQQueueManager} queueManager - The queueManager's config obj.
 */
export interface IMQChannel {
  /** The name of the channel */
  name: string;
  /** The queueManager's config obj */
  queueManager: IMQQueueManager;
}

/**
 * Defining the interface for the options of the module
 * @property {boolean} [debug] - Enable debug mode. Default is false.
 * @property {number} [maxConsecutiveGets] - How many
 *   messages to get from a queue before trying a different queue. Default
 *   is 100
 * @property {number} [getLoopPollTimeMs] - Milliseconds between each full
 * poll cycle. Default is 10000 (10 seconds).
 * @property {number} [getLoopDelayTimeMs] - Milliseconds to delay after a
 *   partial poll cycle. Default is 250 (1/4 second)
 * @property {MQMatchMessageMode} [matchMessageMode] - Set the message
 * filter when make a get to a queue. You can filter by msg id or none.
 * Default is MSG_ID.
 */
export interface IMQOptions {
  /** Enable debug mode. Default is false. */
  debug?: boolean;

  /** How many messages to get from a queue before trying a different queue.
   * Default is 100
   */
  maxConsecutiveGets?: number;

  /** Milliseconds between each full poll cycle. Default is 10000 (10
   *  seconds). */
  getLoopPollTimeMs?: number;

  /**
   * Milliseconds to delay after a partial poll cycle. Default is 250 (1/4
   * second).
   */
  getLoopDelayTimeMs?: number;
}

/**
 * Defining the interface for the option's module.
 * @property {IMQChannel} channel - channel used to connect to queueManager.
 * @property {IMQCredentials} [credentials] - credentials config object.
 * @property {LoggerService} [logger] - set the logger, default is NestJs Logger
 * @property {IMQOptions} [options] - set the module's options.
 */
export interface IMQConfig {
  /** channel config object */
  channel: IMQChannel;

  /** credentials config object */
  credentials?: IMQCredentials;

  /** set the logger, default is NestJs Logger */
  logger?: LoggerService;

  /** set the module's options. */
  options?: IMQOptions;
}
```

## Usage with Interceptors, Guards and Filters

These functionalities will be implemented in future developments.

## Usage with Controllers

You can use NestJS controllers as handlers.

### WARNING: When using controllers, be aware that no HTTP context is available. You can not combine in a controller rest methods with ibm-mq handlers.

```typescript
import {
  AdditionalInfo, IbmMqConnection, MQObjectType, MQQueueSubscribe,
} from '@yeisonkirax/ibm-mq-nest';

@Controller()
export class AppController {
  constructor() {
  }

  @MQQueueSubscribe({
    targetName: 'DEV.QUEUE.1',
  })
  async queueHandler(msg: string, additionalInfo: AdditionalInfo, error: MQError,) {
  }
}
```

You only need to set the name of the queue that is managed by the
queueManager defined above. You can also subscribe to topics using
`MQTopicSubscribe` decorator. In the same way, you only have to pass the name of
the topic to subscribe.

```typescript
import {
  AdditionalInfo, IbmMqConnection, MQObjectType, MQQueueSubscribe,
} from '@yeisonkirax/ibm-mq-nest';

@Controller()
export class AppController {
  constructor() {
  }

  @MQTopicSubscribe({
    targetName: 'dev/',
  })
  async topicHandler(msg: string, additionalInfo: AdditionalInfo, error: MQError,) {
  }
}
```

## Receiving Messages

A handler can receive:

* `msg`: correspond the message deserialized as `string`.
* `additionalInfo`: correspond the raw data.
* `error`: if exist an error, this parameter will be a `MQError` instance.

### Dealing with the original message

If you need the original message. You can use `additionalInfo` in the
handler. This parameter has the following structure.

```typescript
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
  correlationId: string; msgId: string; rawMessage: Buffer; messageDescriptor: MQMD;
};
```

## Sending Messages

### Inject the IbmMqConnection

All IBM MQ interactions go through the `IbmMqConnection` object. Assuming you
installed and configured the `IbmMqNestModule`, the object can be obtained
through Nest's dependency injection system. Simply require it as a constructor
parameter in a Nest Controller or Service.

```typescript
@Controller()
export class AppController {
  constructor(private readonly ibmMqConnection: IbmMqConnection) {
  }

}
```

### Publishing Messages

If you just want to publish a message onto a queue or topic, use
the `publish` method of the `IbmMqConnection` which has the following signature:

```typescript
/**
 * `PublishMessageOptions` is an object with a `target` property that is either
 * a
 * `TopicOptions` or a `QueueOptions` object, and an optional `replyToQueue`
 * property.
 * @property {TopicOptions | QueueOptions} target - The target topic or queue
 *   to publish the message to.
 * @property {string} replyToQueue - The name of the queue to which the service
 * should send the reply.
 */
export type PublishMessageOptions = {
  /** The target topic or queue to publish the message to */
  target: TopicOptions | QueueOptions;

  /** The name of the queue to which the service should send the reply. */
  replyToQueue?: string;
};

class IbmMqConnection {
  /**
   * It opens a queue or topic, puts a message on it, and closes the queue or
   * topic
   * @param {string} message - The message to be sent.
   * @param {PublishMessageOptions} msgOptions - PublishMessageOptions
   * @returns The return value is a Promise that resolves with the msg id.
   */
  public async publish(message: string, msgOptions: PublishMessageOptions): Promise<{ msgId: Buffer }> {
  }
}
```

For example:

```typescript
this.ibmMqConnection.publish('some-text', {
  target: {
    name: 'DEV.QUEUE.1', type: MQObjectType.QUEUE,
  }, replyToQueue: 'DEV.QUEUE.2'
});
```

### Waiting for a response

If you need wait for a response, you can use the `getMessagesFromQueue` method
of the `IbmMqConnection` which has the following signature:

```typescript
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

class IbmMqConnection {
  /**
   * Get the messages from a queue.
   * @param {GetMessagesConfig} options - The message to be sent.
   * @returns The return a Promise that resolves with the msg as string or
   * an error.
   */
  public async getMessagesFromQueue(options: GetMessagesConfig,): Promise<string> {
  }
}
```

## IMPORTANT: THIS MODULE IS UNDER DEVELOPMENT SO IS POSSIBLE THAT CAN EXISTS BUGS, PLEASE BE CAREFULLY.