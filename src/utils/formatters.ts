export const formatCurrency = (value: number): string => {
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  // console.log(`formatCurrency received: ${value}, returned: ${formattedValue}`); // Temporário para depuração
  return formattedValue;
};