#!/bin/bash
set +x
set -e

if [ "$#" -eq 0 ]; then
  printf "\360\237\221\207\360\237\221\207\360\237\221\207 ${rrr} Visit the below link${sss}${eee}${rrr}\360\237\221\207\360\237\221\207\360\237\221\207${eee}\nhttps://login.cf.eu10-004.hana.ondemand.com/passcode\n\n"
  printf 'Copy the passcode and run the script again with:\n\n'
  echo 'npm run setup <passcode>'
  exit 1
else
  passcode=$1
fi

touch local-router/default-env.json

cfServiceName=mccsettings
cfSpace=mcc-settings

cf api https://api.cf.eu10-004.hana.ondemand.com
cf login --sso-passcode $passcode -o sapit-customersupport-dev-mallard -s $cfSpace
if [[ "$OSTYPE" == "msys" ]]; then
  echo "Windows environment detected"
  xsuaaCredentials=$(cf service-key "$cfServiceName"'-xsuaa-srv' local | sed "1,3d; $d")
  destinationServiceCredentials=$(cf service-key "$cfServiceName"'-destination-service' local | sed "1,3d;$d")
else
  xsuaaCredentials=$(cf service-key "$cfServiceName"'-xsuaa-srv' local | sed 1,4d | head -n -2)
  destinationServiceCredentials=$(cf service-key "$cfServiceName"'-destination-service' local | sed 1,4d | head -n -2)
fi

echo '{
    "destinations": [
        {
            "name": "local",
            "url": "http://localhost:8080",
            "forwardAuthToken": true
        }
    ],
    "VCAP_SERVICES": {
        "xsuaa": [
            {
                "name": "'"$cfServiceName"'-xsuaa-srv",
                "label": "xsuaa",
                "tags": [
                    "xsuaa"
                ],
                "credentials":  {
                  '"$xsuaaCredentials"'
            }
        ],
        "destination": [
            {
                "name": "'"$cfServiceName"'-destination-service",
                "label": "destination",
                "tags": [
                    "destination"
                ],
                "credentials": {
                  '"$destinationServiceCredentials"'
            }
        ]
    }
}' > local-router/default-env.json

cd local-router
npm install
cd ..
npm install