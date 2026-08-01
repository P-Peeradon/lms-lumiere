import pika 

class AMQPReceiver:
    def __init__(self, host, queue):
        self.host = host
        self.queue = queue
        self.connection = None
        self.channel = None

    def connect(self):
        self.connection = pika.BlockingConnection(pika.ConnectionParameters(host=self.host))
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=self.queue)

    def start_consuming(self, callback):
        if not self.channel:
            raise Exception("Not connected to AMQP server.")
        self.channel.basic_consume(queue=self.queue, on_message_callback=callback, auto_ack=True)
        print(f"Waiting for messages in queue: {self.queue}. To exit press CTRL+C")
        self.channel.start_consuming()

    def close(self):
        if self.connection:
            self.connection.close()