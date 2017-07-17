# Debezium-mysql-connector

Make synchronous operation between mysql and redis.

# MySQL binlog On (modify MySQL configuration file)
server-id=2331
lob_bn=mysql-bin
binlog_format=row

# STEPs
1. npm init

2. npm install

3. ./bin/zookeeper-server-start ./etc/kafka/zookeeper.properties >> ../zookeeper/zookeeper.log &

4. ./bin/kafka-server-start ./etc/kafka/server.properties

5. ./bin/connect-distributed ./etc/schema-registry/connect-avro-distributed.properties

6. curl -H "Accept:application/json" localhost:8083/

7. curl -H "Accept:application/json" localhost:8083/connectors/

8. curl -i -X POST -H "Accept:application/json" -H "Content-Type:application/json" localhost:8083/connectors/ -d '{ "name": "debe-connector", "config": { "connector.class":"io.debezium.connector.mysql.MySqlConnector", "tasks.max": "1", "database.hostname": "localhost", "database.port": "3306", "database.user": "root", "database.password": "xxx", "database.server.id": "2331", "database.server.name": "dbserver", "database.whitelist": "kafka", "database.history.kafka.bootstrap.servers": "localhost:9092", "database.history.kafka.topic": "dbhistory.debetopic" } }'

9. curl -X GET localhost:8083/connectors/debe-connector

10. config config.json

11. pm2 start pm2.json
