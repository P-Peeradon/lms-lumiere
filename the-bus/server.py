from network_comm.amqp_receiver import AMQPReceiver


def on_message(ch, method, properties, body):
    print(f"Received message: {body}")

def main():
    connection = AMQPReceiver(host='localhost', queue='bus_queue', port=5672)
    connection.connect()
    connection.start_consuming(on_message)


if __name__ == "__main__":
    main()