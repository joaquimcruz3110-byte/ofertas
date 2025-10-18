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
import { Button } from '@/components/ui/button';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
// import { formatCurrency } from '@/utils/formatters'; // Importar a nova função - Removido

interface CommissionRate {
  id: string;
  rate: number;
  set_by_admin_id: string | null;
  set_date: string;
  active: boolean;
}

const commissionRateFormSchema = z.object({
  rate: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, "A taxa de comissão deve ser maior que zero.").max(100, "A taxa de comissão não pode ser maior que 100.")
  ),
  active: z.boolean().default(true),
});

type CommissionRateFormValues = z.infer<typeof commissionRateFormSchema>;

const GerenciarComissoes = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [commissionRates, setCommissionRates] = useState<CommissionRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CommissionRateFormValues>({
    resolver: zodResolver(commissionRateFormSchema),
    defaultValues: {
      rate: 0,
      active: true,
    },
  });

  const fetchCommissionRates = async () => {
    setIsLoadingRates(true);
    const { data, error } = await supabase
      .from('commission_rates')
      .select('*')
      .order('set_date', { ascending: false });

    if (error) {
      showError('Erro ao carregar taxas de comissão: ' + error.message);
      console.error('Erro ao carregar taxas de comissão:', error.message);
      setCommissionRates([]);
    } else {
      setCommissionRates(data as CommissionRate[]);
    }
    setIsLoadingRates(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'administrador') {
      fetchCommissionRates();
    }
  }, [session, isSessionLoading, userRole]);

  const handleAddRateClick = () => {
    setEditingRate(null);
    form.reset({
      rate: 0,
      active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEditRateClick = (rate: CommissionRate) => {
    setEditingRate(rate);
    form.reset({
      rate: rate.rate,
      active: rate.active,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteRate = async (rateId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta taxa de comissão?")) {
      return;
    }

    const toastId = showLoading('Excluindo taxa de comissão...');
    const { error } = await supabase
      .from('commission_rates')
      .delete()
      .eq('id', rateId);

    dismissToast(toastId);
    if (error) {
      showError('Erro ao excluir taxa de comissão: ' + error.message);
      console.error('Erro ao excluir taxa de comissão:', error.message);
    } else {
      showSuccess('Taxa de comissão excluída com sucesso!');
      setCommissionRates(prevRates => prevRates.filter(r => r.id !== rateId));
    }
  };

  const onSubmit = async (values: CommissionRateFormValues) => {
    setIsSubmitting(true);
    const toastId = showLoading(editingRate ? 'Atualizando taxa de comissão...' : 'Adicionando taxa de comissão...');

    let error = null;
    if (editingRate) {
      const { error: updateError } = await supabase
        .from('commission_rates')
        .update({
          rate: values.rate,
          active: values.active,
        })
        .eq('id', editingRate.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('commission_rates')
        .insert({
          rate: values.rate,
          active: values.active,
          set_by_admin_id: session?.user?.id,
        });
      error = insertError;
    }

    dismissToast(toastId);
    if (error) {
      showError('Erro ao salvar taxa de comissão: ' + error.message);
      console.error('Erro ao salvar taxa de comissão:', error.message);
    } else {
      showSuccess(editingRate ? 'Taxa de comissão atualizada com sucesso!' : 'Taxa de comissão adicionada com sucesso!');
      setIsDialogOpen(false);
      fetchCommissionRates(); // Recarrega a lista de taxas
    }
    setIsSubmitting(false);
  };

  if (isSessionLoading || isLoadingRates) {
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
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Gerenciar Comissões</h1>
      <p className="text-lg text-gray-600 mb-8">
        Aqui você pode visualizar, adicionar, editar e excluir as taxas de comissão da plataforma.
      </p>

      <div className="flex justify-end mb-4">
        <Button onClick={handleAddRateClick} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Taxa
        </Button>
      </div>

      {commissionRates.length === 0 ? (
        <p className="text-center text-gray-500">Nenhuma taxa de comissão encontrada.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taxa (%)</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead>Definida em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissionRates.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell className="font-medium">{rate.rate.toFixed(2)}%</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${rate.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {rate.active ? 'Sim' : 'Não'}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(rate.set_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditRateClick(rate)}
                      className="mr-2"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRate(rate.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingRate ? "Editar Taxa de Comissão" : "Adicionar Nova Taxa de Comissão"}</DialogTitle>
            <DialogDescription>
              {editingRate ? "Faça alterações na taxa de comissão existente." : "Preencha os detalhes para adicionar uma nova taxa de comissão."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Taxa de Comissão (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Ex: 5.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Ativa</FormLabel>
                      <DialogDescription>
                        Define se esta taxa de comissão está atualmente em uso.
                      </DialogDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingRate ? "Salvar Alterações" : "Adicionar Taxa"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GerenciarComissoes;