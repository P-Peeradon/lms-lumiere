import pika 

class AMQPReceiver:
    def __init__(self, host, queue, port=5672):
        self.host = host
        self.port = port
        self.queue = queue
        self.connection = None
        self.channel = None

    def connect(self):
        try:
            print(f"Attempting to connect to AMQP server at {self.host}:{self.port}")
            self.connection = pika.BlockingConnection(
                pika.ConnectionParameters(
                    host=self.host,
                    port=self.port,
                    heartbeat=600,
                    blocked_connection_timeout=300,
                )
            )
        except pika.exceptions.AMQPConnectionError as ex:
            print(f"Failed to connect to AMQP server: {ex}")
            raise RuntimeError(
                f"Cannot connect to AMQP broker at {self.host}:{self.port}"
            ) from ex
        self.channel = self.connection.channel()
        self.channel.queue_declare(queue=self.queue, durable=True)
        print(f"Connected to AMQP server at {self.host}:{self.port} successfully, listening on queue '{self.queue}'")

    def start_consuming(self, callback):
        if not self.channel:
            raise RuntimeError("Not connected to AMQP server.")

        self.channel.basic_consume(
            queue=self.queue,
            on_message_callback=callback,
            auto_ack=True,
        )
        print(f"Waiting for messages in queue: {self.queue}. To exit press CTRL+C")
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            print("Stopping AMQP consumer...")
            self.close()

    def close(self):
        if self.connection and not self.connection.is_closed:
            self.connection.close()