import pika

class AMQPSender:
    
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
        print(f"Connected to AMQP server at {self.host}:{self.port} successfully, ready to send messages to queue '{self.queue}'")
    
    def send_message(self, message):
        if not self.channel:
            raise RuntimeError("Not connected to AMQP server.")
        
        self.channel.basic_publish(
            exchange='',
            routing_key=self.queue,
            body=message,
            properties=pika.BasicProperties(
                delivery_mode=2,  # make message persistent
            )
        )
        print(f"Sent message: {message}")