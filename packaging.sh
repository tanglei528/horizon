#! /bin/bash

LOG_FILE=/tmp/packaging.log
LOG_MESSAGE="Details in ${LOG_FILE}"

echo 'Starting packaging...'
[ -f '$LOG_FILE' ] && rm -f ${LOG_FILE}

echo 'Clean old compressed data...'
[ -d static/dashboard/ ] && rm -rf static/dashboard/
if [ -d openstack_dashboard/static/dashboard/css ] ; then
  rm -rf openstack_dashboard/static/dashboard/css
fi
if [ -d openstack_dashboard/static/dashboard/js ] ; then
  rm -rf openstack_dashboard/static/dashboard/js
fi
echo 'Compress js, less, etc...'
tools/with_venv.sh ./manage.py compress > ${LOG_FILE} 2>&1
if [ $? -ne 0 ]; then
  echo "Error: compress failed. ${LOG_MESSAGE}"
  exit 1
fi
cp -f static/dashboard/manifest.json openstack_dashboard/static/dashboard/manifest.json
cp -rf static/dashboard/css/ openstack_dashboard/static/dashboard/
cp -rf static/dashboard/js/ openstack_dashboard/static/dashboard/

echo 'Prepare production local setting'
if [ -f openstack_dashboard/local/local_settings.py ] ; then
  mv -f openstack_dashboard/local/local_settings.py openstack_dashboard/local/local_settings.py.backup
fi
cp openstack_dashboard/local/local_settings.py.production openstack_dashboard/local/local_settings.py

echo 'Pack horizon...'
echo 'Prepare setup.cfg'
cp -f setup-vscloud-horizon.cfg setup.cfg
echo 'Build rpm package...'
python setup.py bdist_rpm >> ${LOG_FILE} 2>&1
if [ $? -ne 0 ]; then
  echo "Error: build horizon rpm package failed. ${LOG_MESSAGE}"
  exit 1
fi

echo 'Pack dashboard...'
echo 'Prepare setup.cfg'
cp -f setup-vscloud-dashboard.cfg setup.cfg
echo 'Build rpm package...'
python setup.py bdist_rpm >> ${LOG_FILE} 2>&1
if [ $? -ne 0 ]; then
  echo "Error: build dashboard rpm package failed. ${LOG_MESSAGE}"
  exit 1
fi

echo 'Pack successfully, rpm packages are in dist/ directory'
mv -f openstack_dashboard/local/local_settings.py.backup openstack_dashboard/local/local_settings.py
exit 0
