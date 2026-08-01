using System.Text;
using RabbitMQ.Client;

namespace the_identity.Network;

public class AmqpSender
{
        readonly string queueName = "identity_queue";

        public async Task SendMessageAsync(string message)
        {

            // 1. Configure the connection factory
            var factory = new ConnectionFactory { HostName = "localhost" };

            // 2. Establish a connection and create a communication channel
            using var connection = await factory.CreateConnectionAsync();
            using var channel = await connection.CreateChannelAsync();

            // 3. Declare a durable, non-exclusive queue
            
            await channel.QueueDeclareAsync(
                queue: queueName,
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: null
            );

            // 4. Prepare and serialize your payload
            
            var body = Encoding.UTF8.GetBytes(message);

            // 5. Publish the message using the default exchange
            await channel.BasicPublishAsync(
                exchange: string.Empty,
                routingKey: queueName,
                body: body
            );

            Console.WriteLine($"[x] Sent: {message}");
        }
}

