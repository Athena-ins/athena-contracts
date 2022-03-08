#!/bin/sh
npm run build && \
tar -cvf ./deploy-athena-ico.tar --exclude='*.map' ./captain-definition ./build/*
#ssh cpecopristo@captain.dev.copristo.com "caprover deploy -t deploy-athena-ico.tar"