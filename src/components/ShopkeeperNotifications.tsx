"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  user_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const ShopkeeperNotifications = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id || userRole !== 'lojista') {
      setNotifications([]);
      setIsLoadingNotifications(false);
      return;
    }

    setIsLoadingNotifications(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      showError('Erro ao carregar notificações: ' + error.message);
      console.error('Erro ao carregar notificações:', error.message);
      setNotifications([]);
    } else {
      setNotifications(data as Notification[]);
    }
    setIsLoadingNotifications(false);
  }, [session, userRole]);

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'lojista') {
      fetchNotifications();
    }
  }, [isSessionLoading, session, userRole, fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    setIsUpdating(notificationId);
    const toastId = showLoading('Marcando como lida...');
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', session?.user?.id);

    dismissToast(toastId);
    if (error) {
      showError('Erro ao marcar notificação como lida: ' + error.message);
      console.error('Erro ao marcar notificação como lida:', error.message);
    } else {
      showSuccess('Notificação marcada como lida!');
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    }
    setIsUpdating(null);
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta notificação?")) {
      return;
    }
    setIsUpdating(notificationId);
    const toastId = showLoading('Excluindo notificação...');
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', session?.user?.id);

    dismissToast(toastId);
    if (error) {
      showError('Erro ao excluir notificação: ' + error.message);
      console.error('Erro ao excluir notificação:', error.message);
    } else {
      showSuccess('Notificação excluída!');
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    }
    setIsUpdating(null);
  };

  if (isLoadingNotifications) {
    return (
      <div className="flex items-center justify-center p-4 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando notificações...
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        <Bell className="mx-auto h-12 w-12 mb-2" />
        <p>Nenhuma notificação nova.</p>
      </div>
    );
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" /> Minhas Notificações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`flex items-center justify-between p-4 rounded-md border ${
                notification.is_read ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div>
                <p className={`font-medium ${notification.is_read ? 'text-gray-700' : 'text-blue-800'}`}>
                  {notification.message}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {format(new Date(notification.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
              <div className="flex space-x-2">
                {!notification.is_read && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkAsRead(notification.id)}
                    disabled={isUpdating === notification.id}
                  >
                    {isUpdating === notification.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteNotification(notification.id)}
                  disabled={isUpdating === notification.id}
                >
                  {isUpdating === notification.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ShopkeeperNotifications;