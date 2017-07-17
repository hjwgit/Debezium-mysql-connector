#!/bin/bash

#--------------------------#
# debezium-mysql-connector #
#--------------------------#

#if Kafka Connect started
#check the status of Kafka Connect 
#if not, start
#curl -H "Accept:application/json" localhost:8083/

kafka_connect=`curl -H "Accept:application/json" localhost:8083`
if [ -z "${kafka_connect}"]; then
    echo 'is empty'
fi
#echo ${kafka_connect}
#echo ${kafka_connect:0-10}

#echo $?

#if Debezium Connector registered
#if not, register a new connector by debezium configuration file
#if registered, check the configuration of connector and update

#start the synchronizer (use node to start)
