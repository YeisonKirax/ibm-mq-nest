import { IbmMqConnection } from './ibm-mq.connection';

export class IbmMqConnectionManager {
  private mqConnections: IbmMqConnection[] = [];

  addConnection(connection: IbmMqConnection) {
    this.mqConnections.push(connection);
  }

  getConnection(name: string) {
    return this.mqConnections.find((connection) => connection.getMqChannel.queueManager.name === name);
  }

  getConnections() {
    return this.mqConnections;
  }

  clearConnections() {
    this.mqConnections = [];
  }
}
