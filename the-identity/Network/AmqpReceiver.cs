using System.Text;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace the_identity.Network;
public class AmqpReceiver
{
    readonly string queueName = "identity_queue";
    public async Task ReceiveMessagesAsync()
    {
        var factory = new ConnectionFactory { HostName = "localhost" };

        using var connection = await factory.CreateConnectionAsync();
        using var channel = await connection.CreateChannelAsync();

        // Ensure the queue exists if the consumer starts up first
        await channel.QueueDeclareAsync(
            queue: queueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null
        );

        // Optimize workload distribution (prefetch 1 message at a time per worker)
        await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false);

        Console.WriteLine("[*] Waiting for messages...");

        // Create the consumer instance
        var consumer = new AsyncEventingBasicConsumer(channel);

        // Attach the asynchronous handler to the ReceivedAsync event
        consumer.ReceivedAsync += async (model, ea) =>
        {
            var body = ea.Body.ToArray();
            var message = Encoding.UTF8.GetString(body);
            
            try
            {
                Console.WriteLine($"[x] Received: {message}");
                
                // Simulate business logic or processing time
                await Task.Delay(1000); 

                // Manually acknowledge successful processing
                await channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false);
            }
            catch (Exception)
            {
                // Requeue the message if an unexpected failure occurs
                await channel.BasicNackAsync(deliveryTag: ea.DeliveryTag, multiple: false, requeue: true);
            }
        };

        // Start consuming from the queue with autoAck disabled for safety
        await channel.BasicConsumeAsync(
            queue: queueName,
            autoAck: false,
            consumer: consumer
        );

        // Keep the console open to allow continuous listening
        Console.ReadLine();
    }
}