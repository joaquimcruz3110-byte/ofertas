"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: 'comprador' | 'lojista' | 'administrador';
  email: string; // Adicionado o campo email
}

const GerenciarUsuarios = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    // Alterado para buscar da nova view 'user_details'
    const { data, error } = await supabase
      .from('user_details')
      .select('id, first_name, last_name, role, email'); // Selecionando o email

    if (error) {
      showError('Erro ao carregar usuários: ' + error.message);
      console.error('Erro ao carregar usuários:', error.message);
      setUsers([]);
    } else {
      setUsers(data as Profile[]);
    }
    setIsLoadingUsers(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'administrador') {
      fetchUsers();
    }
  }, [session, isSessionLoading, userRole]);

  const handleRoleChange = async (userId: string, newRole: 'comprador' | 'lojista' | 'administrador') => {
    setUpdatingUserId(userId);
    const toastId = showLoading('Atualizando papel do usuário...');

    const { error } = await supabase
      .from('profiles') // A atualização ainda é feita na tabela 'profiles'
      .update({ role: newRole })
      .eq('id', userId);

    dismissToast(toastId);
    if (error) {
      showError('Erro ao atualizar papel: ' + error.message);
      console.error('Erro ao atualizar papel:', error.message);
    } else {
      showSuccess('Papel do usuário atualizado com sucesso!');
      // Atualiza a lista de usuários localmente para refletir a mudança
      setUsers(prevUsers =>
        prevUsers.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        )
      );
    }
    setUpdatingUserId(null);
  };

  if (isSessionLoading || isLoadingUsers) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'administrador') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Acesso Negado</h1>
          <p className="text-xl text-gray-600">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Gerenciar Usuários</h1>
      <p className="text-lg text-gray-600 mb-8">
        Aqui você pode visualizar e alterar os papéis dos usuários na plataforma.
      </p>

      {users.length === 0 ? (
        <p className="text-center text-gray-500">Nenhum usuário encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Nome não disponível'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell> {/* Agora exibe o email correto do usuário */}
                  <TableCell className="capitalize">
                    <Select
                      value={user.role}
                      onValueChange={(newRole: 'comprador' | 'lojista' | 'administrador') => handleRoleChange(user.id, newRole)}
                      disabled={updatingUserId === user.id}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Selecionar Papel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comprador">Comprador</SelectItem>
                        <SelectItem value="lojista">Lojista</SelectItem>
                        <SelectItem value="administrador">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    {updatingUserId === user.id && (
                      <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default GerenciarUsuarios;