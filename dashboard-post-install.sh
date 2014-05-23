[ -d /etc/vscloud-dashboard ] || mkdir /etc/vscloud-dashboard
[ -d /var/log/vscloud-dashboard ] || mkdir -p /var/log/vscloud-dashboard
touch /var/log/vscloud-dashboard/horizon.log
chown -R apache:apache /var/log/vscloud-dashboard
ln -sf /usr/share/vscloud-dashboard/openstack_dashboard/local/local_settings.py /etc/vscloud-dashboard/local_settings
ln -sf /usr/share/vscloud-dashboard/openstack_dashboard/conf/nova_policy.json /etc/vscloud-dashboard/nova_policy.json
ln -sf /usr/share/vscloud-dashboard/openstack_dashboard/conf/glance_policy.json /etc/vscloud-dashboard/glance_policy.json
ln -sf /usr/share/vscloud-dashboard/openstack_dashboard/conf/keystone_policy.json /etc/vscloud-dashboard/keystone_policy.json
ln -sf /usr/share/vscloud-dashboard/openstack_dashboard/conf/cinder_policy.json /etc/vscloud-dashboard/cinder_policy.json
# install httpd conf file
[ -f /etc/httpd/conf.d/vscloud-dashboard.conf ] || cp /usr/share/vscloud-dashboard/openstack_dashboard/conf/vscloud-dashboard.conf /etc/httpd/conf.d/
# move static content
[ -d /usr/share/vscloud-dashboard/static ] && rm -rf /usr/share/vscloud-dashboard/static
mv /usr/share/vscloud-dashboard/openstack_dashboard/static /usr/share/vscloud-dashboard/
