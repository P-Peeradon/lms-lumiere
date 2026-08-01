import amqp, { type ChannelModel, type Channel } from 'amqplib';

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

export default sendMessage;