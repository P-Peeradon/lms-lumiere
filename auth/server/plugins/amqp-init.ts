// This code is used to initialize the AMQP connection for the auth service. 
// It opens the receiver to read the messages from the queue and process them accordingly.
import { definePlugin } from 'nitro/h3';
import receiveMessage from '../../network_socket/amqpReceiver.ts';

export default definePlugin(async () => {
    try {
        await receiveMessage();
    } catch (error) {
        console.error('Error initializing AMQP:', error);
    } 
});