#!/bin/bash

./gradlew clean shadowjar; java -jar build/libs/OS.js-v2-3.2.1-fat.jar
