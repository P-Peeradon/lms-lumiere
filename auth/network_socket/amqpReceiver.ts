import amqp, { type Channel, type ChannelModel, type ConsumeMessage } from 'amqplib';
import { useRuntimeConfig } from 'nitro/runtime-config';

const config = useRuntimeConfig();

const AMQP_URL: string = config.amqpUrl || 'amqp://localhost:5672';
const QUEUE_NAME: string = 'auth_queue'; // "auth_queue" is the name of the queue where messages will be sent and received

async function receiveMessage(): Promise<void> {
    let connection: ChannelModel | null = null;
    let channel: Channel | null = null;

    try {
        // Establish a connection to the AMQP server
        connection = await amqp.connect(AMQP_URL);
        console.log('Successfully connected to RabbitMQ');
        channel = await connection?.createChannel();

        // 3. Ensure the queue exists (durable: true survives server restarts)
        await channel.assertQueue(QUEUE_NAME, { durable: true });

        // 4. Prefetch: Fair dispatch (don't give more than 1 message to a worker at a time)
        await channel.prefetch(1);

        console.log(`Waiting for messages in queue: "${QUEUE_NAME}". To exit press CTRL+C`);

        // 5. Start consuming messages
        await channel.consume(
            QUEUE_NAME,
            (msg: ConsumeMessage | null) => {
                if (msg) {
                    const content = msg.content.toString();
                    console.log(`[x] Received: ${content}`);

                    // Simulate processing work, then acknowledge message
                    setTimeout(() => {
                        console.log('[x] Done processing');
                        channel?.ack(msg);
                    }, 1000);
                }
            },
            { 
                // noAck: false ensures messages aren't lost if the worker dies midway
                noAck: false 
            }
        );

        process.on('SIGINT', async () => {
            console.log('\n[x] Shutting down receiver gracefully...');
            try {
                await channel?.close();
                await connection?.close();
                console.log('[x] Connection closed.');
            } catch (err) {
                console.error('Error during shutdown:', err);
            }
            process.exit(0);
        });
    }  catch (error) {
        console.error('Failed to connect or consume from RabbitMQ:', error);
        setTimeout(receiveMessage, 5000); // Simple retry attempt
    } finally {
        if (channel) await channel?.close();
        if (connection) await connection?.close();
    }

}

export default receiveMessage;