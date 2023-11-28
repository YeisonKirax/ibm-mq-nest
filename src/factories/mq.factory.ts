import { ParamData } from '@nestjs/common';
import { IBM_MQ_HEADER_TYPE, IBM_MQ_PARAM_TYPE, IBM_MQ_REQUEST_TYPE } from '../constants/mq.constants';
import { IMQChannel, IMQCredentials, IMQOptions } from '../interfaces/mq.interfaces';
import { IbmMqConnection } from '../ibm-mq/ibm-mq.connection';
import { isObject } from 'class-validator';

export class IbmMqParamsFactory {
  public exchangeKeyForValue(type: number, data: ParamData, args: any[]) {
    if (!args) {
      return null;
    }

    let index = 0;
    if (type === IBM_MQ_PARAM_TYPE) {
      index = 0;
    } else if (type === IBM_MQ_REQUEST_TYPE) {
      index = 1;
    } else if (type === IBM_MQ_HEADER_TYPE) {
      index = 2;
    }

    return data && !isObject(data) ? args[index]?.[data] : args[index];
  }
}

/* It creates a new instance of the IbmMqConnection class, initializes it, and
 returns it */
export class IbmMqConnectionFactory {
  async createConnection(channel: IMQChannel, credentials: IMQCredentials, options: IMQOptions) {
    const connection = new IbmMqConnection(channel, credentials, options);
    await connection.init();
    return connection;
  }
}
