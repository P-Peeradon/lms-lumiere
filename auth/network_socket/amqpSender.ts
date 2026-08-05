import type { EventAMQP, ShadowID, University } from '#helper/interface.ts';
import amqp, { type ChannelModel, type Channel } from 'amqplib';
import { v4 as UUIDv4, type UUIDTypes } from 'uuid';
import { ServiceName } from "#helper/interface.ts"

const AMQP_URL: string = 'amqp://localhost:5672';
const QUEUE_NAME: string = 'auth_queue';

async function sendMessage(message: string): Promise<void> {
    let connection: ChannelModel | null = null;
    let channel: Channel | null = null;

    try {
        // Establish a connection to the AMQP server
        connection = await amqp.connect(AMQP_URL);
        channel = await connection?.createChannel();

        await channel?.assertQueue(QUEUE_NAME, { durable: true });

        const payload: Buffer = Buffer.from(JSON.stringify(message));

        // 5. Send the message to the queue
        // persistent: true ensures the message survives RabbitMQ restarts
        await channel?.sendToQueue(QUEUE_NAME, payload, { persistent: true });
        
        console.log(`[x] Sent:`, message);
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    } finally {
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}

async function emitEvent(requesterShadowID: ShadowID, exchangeName: string, routingKey: string, payload: any, tenant: University): Promise<void> {
    let connection: ChannelModel | null = null;
    let channel: Channel | null = null;

    try {
        // 1. Connect to RabbitMQ Server
        connection = await amqp.connect(AMQP_URL);
        channel = await connection?.createChannel();

        // 2. Define exchange parameters
        const exchangeType = "topic";
        const eventType = 'event';

        // 3. Ensure the exchange exists
        await channel.assertExchange(exchangeName, exchangeType, { durable: true });
        const eventID: string = UUIDv4();

        const event: EventAMQP = {
            eventID,
            eventType,
            payload,
            shadowID: requesterShadowID,
            timestamp: new Date().toISOString(),
            meta: {
                tenant,
                sourceService: ServiceName.Auth,
                version: "1.0"
            }
        }

        // 5. Emit the event
        channel.publish(
            exchangeName,
            routingKey,
            Buffer.from(JSON.stringify(event)),
            { persistent: true } // Ensures event is persisted to disk
        );

        console.log(` [x] Emitted event '${routingKey}':`, event);

        
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    } finally {
        // 6. Close communication channels gracefully
        if (channel) await channel.close();
        if (connection) await connection.close();
    }
}

export default { sendMessage, emitEvent };