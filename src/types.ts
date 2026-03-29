export type View = 'dashboard' | 'clientes' | 'veiculos' | 'ordens' | 'orcamentos' | 'agenda' | 'relatorios' | 'configuracoes' | 'pecas';

export interface Peca {
  id: string;
  uid: string;
  codigo: string;
  descricao: string;
  marca?: string;
  precoCusto: number;
  precoVenda: number;
  estoque: number;
  estoqueMinimo?: number;
  unidade: string;
  createdAt: any;
}

export interface Cliente {
  id: string;
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  cpf_cnpj: string;
  inscricao_estadual?: string;
  inscricao_municipal?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  createdAt: any;
}

export interface Veiculo {
  id: string;
  uid: string;
  clienteId: string;
  clienteNome?: string;
  modelo: string;
  marca: string;
  ano: number;
  placa_serie: string;
  tipo: string;
  createdAt: any;
}

export interface OrdemServico {
  id: string;
  uid: string;
  numero: string;
  clienteId: string;
  clienteNome?: string;
  veiculoId: string;
  status: 'Aberta' | 'Em Andamento' | 'Aguardando Peças' | 'Finalizada' | 'Cancelada';
  tecnicoResponsavel: string;
  descricao: string;
  fotos?: string[];
  quilometragemInicial?: string;
  quilometragemFinal?: string;
  observacoes?: string;
  valorTotal: number;
  dataAbertura: any;
  dataFinalizacao?: any;
  dataTermino?: any;
  createdAt: any;
  pecas?: PecaUtilizada[];
}

export interface PecaUtilizada {
  item: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
}

export interface Configuracao {
  id: string;
  uid: string;
  nomeOficina: string;
  cnpj: string;
  inscricaoMunicipal?: string;
  inscricaoEstadual?: string;
  endereco: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  logo?: string;
  termoGarantia?: string;
  validadePadraoOrcamento?: number;
  tecnicoPadrao?: string;
  exibirLogoNoPdf?: boolean;
  exibirFotosNoPdf?: boolean;
}

export interface Orcamento {
  id: string;
  uid: string;
  numero: string;
  clienteId: string;
  clienteNome?: string;
  veiculoId: string;
  status: 'Pendente' | 'Aprovado' | 'Recusado' | 'Vencido';
  tecnicoResponsavel: string;
  descricao: string;
  fotos?: string[];
  quilometragemInicial?: string;
  quilometragemFinal?: string;
  observacoes?: string;
  valorTotal: number;
  validade: string; // ISO date string
  createdAt: any;
  pecas?: PecaUtilizada[];
}

export interface Agendamento {
  id: string;
  uid: string;
  data: any;
  hora: string;
  clienteId: string;
  clienteNome?: string;
  veiculoId?: string;
  osId?: string;
  servico?: string;
  descricao: string;
  local?: string;
  status: 'Pendente' | 'Confirmado' | 'Concluído' | 'Cancelado';
  createdAt: any;
}

export interface Usuario {
  id: string;
  uid: string;
  nome: string;
  email: string;
  role: 'adm' | 'tecnico';
  senha?: string;
  createdAt: any;
}

export interface DocumentoPdf {
  id: string;
  uid: string;
  recordType: 'ordem_servico' | 'orcamento' | 'relatorio';
  recordId: string;
  fileName: string;
  mimeType: string;
  base64Content: string;
  createdAt: any;
  updatedAt: any;
}
