from network_comm.amqp_receiver import AMQPReceiver

def main():
    connection = AMQPReceiver(host='localhost', queue='bus_queue')
    connection.connect()
    
    connection.start_consuming(lambda ch, method, properties, body: print(f"Received message: {body}"))  # Replace with actual callback function
    
if __name__ == "__main__":
    main()