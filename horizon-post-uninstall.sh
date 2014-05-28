VER=`python --version 2>&1`
if [ "${VER:0:10}" = 'Python 2.6' ]; then
  INSTALL_PATH=/usr/lib/python2.6/site-packages
elif [ "${VER:0:10}" = 'Python 2.7' ]; then
  INSTALL_PATH=/usr/lib/python2.7/site-packages
fi
[ -d ${INSTALL_PATH}/horizon ] && rm -rf ${INSTALL_PATH}/horizon
