import {LoggerService} from '@nestjs/common';

export enum MQObjectType {
  TOPIC = 'TOPIC',
  QUEUE = 'QUEUE',
}

export enum MatchMessageMode {
  MSG_ID = 'MSG_ID',
  NONE = 'NONE',
}

/**
 * represents the type of the handler.
 * */
export declare type MQHandlerType = MQObjectType.TOPIC | MQObjectType.QUEUE;

/**
 * represents the ways to get messages from a queue or topic
 * */
export declare type MQMatchMessageMode =
  | MatchMessageMode.MSG_ID
  | MatchMessageMode.NONE;

export declare type MQHandlers = Record<string, any>;

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

/**
 * Defining the interface for the options of the message handler.
 * @property {string} queueManagerName - Name of the connected queue manager.
 * @property {string} channelName - Name of the channel used.
 * @property {string} targetName - Name of the topic o queue where the
 * message will be published.
 * @property {MQObjectType} targetType -Type of the mqObject (queue or topic)
 *   that will be published the message
 */
export interface IMQMessageHandler {
  /** Name of the connected queue manager */
  queueManagerName: string;

  /** Name of the channel used */
  channelName: string;

  /** Name of the topic o queue where the
   message will be published. */
  targetName: string;

  /** Type of the mqObject (queue or topic)
   that will be published the message */
  targetType: MQObjectType;
}

export interface IMQDecoratorOptions {
  /** Name of the topic o queue where the message will be published.
   */
  targetName: string;

  /**
   * Type of the mqObject (queue or topic) that will be published the message
   */
  targetType: MQObjectType;
}
