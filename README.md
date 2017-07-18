# Debezium-mysql-connector

Make synchronous operation between mysql and redis.

### MySQL binlog On

server-id=2331<br>
lob_bin=mysql-bin<br>
binlog_format=row<br>

## STEPs
1. npm init

2. npm install

3. start zookeeper (localhost:2181)
./bin/zookeeper-server-start ./etc/kafka/zookeeper.properties >> ../zookeeper/zookeeper.log &

4. start kafka broker (localhost:9092)
./bin/kafka-server-start ./etc/kafka/server.properties

5. start kafka connect (localhost:8083)
./bin/connect-distributed ./etc/schema-registry/connect-avro-distributed2.properties

6. check if kafka connect started
curl -H "Accept:application/json" localhost:8083/

7. get list of registered connectors
curl -H "Accept:application/json" localhost:8083/connectors/

8. register a new connector
curl -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" localhost:8083/connectors/ -d '{ "name": "debe-connector", "config": { "connector.class": "io.debezium.connector.mysql.MySqlConnector", "tasks.max": "1", "database.hostname": "localhost", "database.port": "3306", "database.user": "root", "database.password": "xxx", "database.server.id": "2331", "database.server.name": "dbserver1", "database.whitelist": "kafka", "database.history.kafka.bootstrap.servers": "localhost:9092", "database.history.kafka.topic": "dbhistory.debetopic" } }'

9. get info of connector
curl -X GET localhost:8083/connectors/debe-connector

10. configure the database name and tables
config config.json

11. start
pm2 start pm2.json
