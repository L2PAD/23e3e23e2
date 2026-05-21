import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertTriangle, Phone, CheckCircle2, XCircle, Copy, PlayCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useLang } from '../../i18n';
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const RingostatAdminPage = () => {
  const { t } = useLang();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState(null);
  const [mappings, setMappings] = useState([]);
  const [staff, setStaff] = useState([]);
  const [calls, setCalls] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Filters for calls history
  const [filters, setFilters] = useState({
    period: 'today',
    manager: null,
    status: null,
    direction: null
  });

  // Load data
  useEffect(() => {
    loadHealth();
    loadSettings();
    loadMappings();
    loadCalls();
    loadEvents();
  }, []);

  const loadHealth = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/health`);
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      console.error('Failed to load health:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/settings`);
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMappings = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/mappings`);
      const data = await res.json();
      setMappings(data.mappings || []);
      setStaff(data.staff || []);
    } catch (error) {
      console.error('Failed to load mappings:', error);
    }
  };

  const loadCalls = async () => {
    try {
      const params = new URLSearchParams(filters).toString();
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/calls?${params}`);
      const data = await res.json();
      setCalls(data.calls || []);
    } catch (error) {
      console.error('Failed to load calls:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/events`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (res.ok) {
        toast({ title: t('adm_settings_saved') });
        loadHealth();
      }
    } catch (error) {
      toast({ title: t('adm_save_error'), variant: 'destructive' });
    }
  };

  const handleTestConnection = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: settings.api_key,
          project_id: settings.project_id
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({ title: t('adm_connection_successful') });
      } else {
        toast({ title: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: t('adm_testing_error'), variant: 'destructive' });
    }
  };

  const handleTestWebhook = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/test-webhook`, {
        method: 'POST'
      });
      
      if (res.ok) {
        toast({ title: t('adm_test_event_sent') });
        setTimeout(() => {
          loadEvents();
          loadHealth();
        }, 1000);
      }
    } catch (error) {
      toast({ title: t('errorGeneric2'), variant: 'destructive' });
    }
  };

  const handleAddMapping = async (extension, managerId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extension, manager_id: managerId })
      });
      
      if (res.ok) {
        toast({ title: t('adm_mapping_created') });
        loadMappings();
        loadHealth();
      }
    } catch (error) {
      toast({ title: t('errorGeneric2'), variant: 'destructive' });
    }
  };

  const handleDeleteMapping = async (extension) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/ringostat/mappings/${extension}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast({ title: t('adm_mapping_deleted') });
        loadMappings();
        loadHealth();
      }
    } catch (error) {
      toast({ title: t('errorGeneric2'), variant: 'destructive' });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: t('adm_copied') });
  };

  if (loading) {
    return <div className="p-8">{t('adm_loading_4')}</div>;
  }

  const getAttentionAlerts = () => {
    const alerts = [];
    
    if (health?.unassigned?.extensions > 0) {
      alerts.push({
        type: 'warning',
        message: `${health.unassigned.extensions}${t('r9_ext_not_assigned_to_mgr')}`
      });
    }
    
    if (health?.connection?.status === 'disconnected') {
      alerts.push({
        type: 'error',
        message: t('adm_ringostat_is_not_connected')
      });
    }
    
    if (health?.unassigned?.calls_today > 0) {
      alerts.push({
        type: 'warning',
        message: `${health.unassigned.calls_today}${t('r9_calls_today_no_manager')}`
      });
    }
    
    return alerts;
  };

  const webhookUrl = `${window.location.origin}/api/integrations/ringostat/webhook`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('ringostatOpsControl')}</h1>
        <p className="text-muted-foreground mt-1">{t('adm_call_management_webhook_managers_and_logic')}</p>
      </div>

      {/* Health Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('adm_connection')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {health?.connection?.status === 'connected' ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {t('connected')}
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <XCircle className="h-4 w-4 mr-1" />
                    {t('disconnected')}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('lastWebhook')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.webhook?.last_event ? (
                <span className="text-sm">{new Date(health.webhook.last_event).toLocaleTimeString()}</span>
              ) : (
                <span className="text-sm text-muted-foreground">{t('adm_no_data_3')}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('adm_calls_today_3')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.calls_today || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">{t('adm_requires_attention')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {getAttentionAlerts().length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attention Alerts */}
      {getAttentionAlerts().length > 0 && (
        <div className="space-y-2">
          {getAttentionAlerts().map((alert, i) => (
            <Alert key={i} variant={alert.type === 'error' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('adm_overview')}</TabsTrigger>
          <TabsTrigger value="settings">{t('adm_settings')}</TabsTrigger>
          <TabsTrigger value="calls">{t('adm_call_history')}</TabsTrigger>
          <TabsTrigger value="debug">{t('adm_debugging')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('operationalStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">{t('webhookLabel')}</div>
                  <div>{health?.webhook?.events_today > 0 ? `🟢 ${t('activeAdj')}` : `⚪ ${t('inactiveAdj')}`}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('apiKey')}</div>
                  <div>{health?.connection?.api_key_set ? `✅ ${t('configured')}` : `⚠️ ${t('notConfigured')}`}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('projectId')}</div>
                  <div>{health?.connection?.project_id_set ? `✅ ${t('configured')}` : `⚠️ ${t('notConfigured')}`}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">{t('managerMappings')}</div>
                  <div>{health?.mappings?.total - health?.mappings?.unmapped} {t('adm3_b98ccbc2df')} {health?.mappings?.total}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('quickActions')}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={handleTestConnection}>{t('testConnectionAction')}</Button>
              <Button onClick={handleTestWebhook} variant="outline">{t('sendTestEvent')}</Button>
              <Button onClick={() => setActiveTab('settings')} variant="outline">{t('openSettings')}</Button>
              <Button onClick={() => setActiveTab('calls')} variant="outline">{t('callHistory')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          {/* Connection & Auth */}
          <Card>
            <CardHeader>
              <CardTitle>{t('ringostatConnection')}</CardTitle>
              <CardDescription>{t('adm_api_key_and_project_id')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('apiKey')}</Label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={settings?.api_key || ''}
                    onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                    placeholder={t('adm_enter_api_key')}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('projectId')}</Label>
                <Input
                  value={settings?.project_id || ''}
                  onChange={(e) => setSettings({ ...settings, project_id: e.target.value })}
                  placeholder="12345"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleTestConnection}>{t('testConnectionAction')}</Button>
                <Button onClick={handleSaveSettings}>{t('saveAction')}</Button>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Setup */}
          <Card>
            <CardHeader>
              <CardTitle>{t('webhookConfiguration')}</CardTitle>
              <CardDescription>{t('adm_configure_this_url_in_ringostat')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('webhookUrl')}</Label>
                <div className="flex gap-2">
                  <Input value={webhookUrl} readOnly />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">{t('lastWebhook')}</div>
                  <div>{health?.webhook?.last_event ? new Date(health.webhook.last_event).toLocaleString() : t('adm3_dee9a2d8d9')}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t('eventsToday')}</div>
                  <div>{health?.webhook?.events_today || 0}</div>
                </div>
              </div>
              <Button onClick={handleTestWebhook} variant="outline">{t('sendTestWebhook')}</Button>
            </CardContent>
          </Card>

          {/* Manager Mapping */}
          <Card>
            <CardHeader>
              <CardTitle>{t('adm_extension_manager_mapping')}</CardTitle>
              <CardDescription>{t('adm3_crm_core_0f564fb39d')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('extensionLabel')}</TableHead>
                    <TableHead>{t('adm_crm_manager')}</TableHead>
                    <TableHead>{t('statusGeneric')}</TableHead>
                    <TableHead>{t('actionsLabel')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => (
                    <TableRow key={mapping.extension}>
                      <TableCell>{mapping.extension}</TableCell>
                      <TableCell>
                        {mapping.manager_name ? (
                          <div>
                            <div className="font-medium">{mapping.manager_name}</div>
                            <div className="text-sm text-muted-foreground">{mapping.manager_email}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{t('notAssigned')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={mapping.status === 'assigned' ? 'default' : 'destructive'}>
                          {mapping.status === 'assigned' ? '✅' : '⚠️'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMapping(mapping.extension)}
                        >
                          {t('deleteAction')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="mt-4 flex gap-2">
                <Input placeholder={t('adm_extension_101')} id="newExt" />
                <Select onValueChange={(value) => {
                  const ext = document.getElementById('newExt').value;
                  if (ext) handleAddMapping(ext, value);
                }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t('selectManager')} />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Automation Rules */}
          <Card>
            <CardHeader>
              <CardTitle>{t('automationRules')}</CardTitle>
              <CardDescription>{t('adm_critical_automation_rules')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t('autoCreateLeadOnUnknown')}</Label>
                <Switch
                  checked={settings?.automation_rules?.auto_create_lead}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      automation_rules: { ...settings.automation_rules, auto_create_lead: checked }
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>{t('createCallbackOnMissed')}</Label>
                <Switch
                  checked={settings?.automation_rules?.missed_call_task}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      automation_rules: { ...settings.automation_rules, missed_call_task: checked }
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Missed call task deadline (minutes)</Label>
                <Input
                  type="number"
                  value={settings?.automation_rules?.missed_call_task_minutes || 5}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      automation_rules: { ...settings.automation_rules, missed_call_task_minutes: parseInt(e.target.value) }
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>{t('requireOutcomeAfterAnswered')}</Label>
                <Switch
                  checked={settings?.automation_rules?.require_outcome}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      automation_rules: { ...settings.automation_rules, require_outcome: checked }
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Show outcome form if duration &gt; (seconds)</Label>
                <Input
                  type="number"
                  value={settings?.automation_rules?.require_outcome_duration || 10}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      automation_rules: { ...settings.automation_rules, require_outcome_duration: parseInt(e.target.value) }
                    })
                  }
                />
              </div>
              <Button onClick={handleSaveSettings}>{t('saveRules')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calls History Tab */}
        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('mobileFiltersTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Select value={filters.period} onValueChange={(v) => setFilters({ ...filters, period: v })}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">{t('adm_today')}</SelectItem>
                  <SelectItem value="week">{t('adm_week')}</SelectItem>
                  <SelectItem value="month">{t('adm_month')}</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={loadCalls}>{t('adm_apply')}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('callsHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adm_time')}</TableHead>
                    <TableHead>{t('adm_number')}</TableHead>
                    <TableHead>{t('adm_direction')}</TableHead>
                    <TableHead>{t('adm_duration')}</TableHead>
                    <TableHead>{t('statusGeneric')}</TableHead>
                    <TableHead>{t('leadLabel')}</TableHead>
                    <TableHead>{t('actionsLabel')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>{new Date(call.started_at).toLocaleString()}</TableCell>
                      <TableCell>{call.from}</TableCell>
                      <TableCell>
                        <Badge variant={call.direction === 'inbound' ? 'default' : 'secondary'}>
                          {call.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{call.duration}s</TableCell>
                      <TableCell>
                        <Badge variant={call.status === 'answered' ? 'default' : 'destructive'}>
                          {call.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {call.lead ? call.lead.name : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => setSelectedCall(call)}>
                          {t('adm_view')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debug Tab */}
        <TabsContent value="debug" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('debugStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>Last webhook payload: {health?.webhook?.last_event ? new Date(health.webhook.last_event).toLocaleString() : t('adm3_dee9a2d8d9')}</div>
              <div>Events today: {health?.webhook?.events_today || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('recentEvents')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('timestampLabel')}</TableHead>
                    <TableHead>{t('eventType')}</TableHead>
                    <TableHead>{t('callIdLabel')}</TableHead>
                    <TableHead>{t('direction')}</TableHead>
                    <TableHead>{t('fromLabel')}</TableHead>
                    <TableHead>{t('durationGeneric')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.slice(0, 10).map((evt) => (
                    <TableRow key={evt.id}>
                      <TableCell>{new Date(evt.timestamp).toLocaleString()}</TableCell>
                      <TableCell><Badge>{evt.event_type}</Badge></TableCell>
                      <TableCell className="font-mono text-sm">{evt.call_id}</TableCell>
                      <TableCell>{evt.direction}</TableCell>
                      <TableCell>{evt.from}</TableCell>
                      <TableCell>{evt.duration}s</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('manualTools')}</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={handleTestConnection}>{t('testConnectionAction')}</Button>
              <Button onClick={handleTestWebhook} variant="outline">{t('testWebhook')}</Button>
              <Button onClick={() => { loadHealth(); loadEvents(); }} variant="outline">{t('reloadData')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Call Details Drawer */}
      <Sheet open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('callDetailsTitle')}</SheetTitle>
            <SheetDescription>{t('adm_call_details')}</SheetDescription>
          </SheetHeader>
          {selectedCall && (
            <div className="mt-6 space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">{t('callIdLabel')}</div>
                <div className="font-mono text-sm">{selectedCall.call_id}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('time')}</div>
                <div>{new Date(selectedCall.started_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('direction')}</div>
                <Badge>{selectedCall.direction}</Badge>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('durationGeneric')}</div>
                <div>{selectedCall.duration} seconds</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">{t('adm_phone')}</div>
                <div>{selectedCall.from}</div>
              </div>
              {selectedCall.lead && (
                <div>
                  <div className="text-sm text-muted-foreground">{t('leadLabel')}</div>
                  <div>{selectedCall.lead.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedCall.lead.phone}</div>
                </div>
              )}
              {selectedCall.recording_url && (
                <Button className="w-full">
                  <PlayCircle className="h-4 w-4 mr-2" />
                  {t('playRecording')}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default RingostatAdminPage;