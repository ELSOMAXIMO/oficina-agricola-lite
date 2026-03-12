import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, FileText, Clock, CheckCircle2, AlertCircle, MoreVertical, Save, Loader2, Edit2, Trash2, Printer, Camera, X, Image as ImageIcon, MessageCircle, Mail } from 'lucide-react';
import { dbService } from '../services/dbService';
import { useAuth } from '../contexts/AuthContext';
import { OrdemServico, Cliente, Veiculo, PecaUtilizada } from '../types';
import { Modal } from './Modal';
import { toast } from 'react-hot-toast';
import { OperationType } from '../utils/firestore';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { CurrencyInput } from './CurrencyInput';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { googleService } from '../services/googleService';
import { pdfArchiveService } from '../services/pdfArchiveService';
import { pdfOpenService } from '../services/pdfOpenService';
import { photoCaptureService } from '../services/photoCaptureService';

interface OrdensServicoViewProps {
  openCreateSignal?: number;
}

export const OrdensServicoView: React.FC<OrdensServicoViewProps> = ({ openCreateSignal = 0 }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [pecasDb, setPecasDb] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingOS, setEditingOS] = useState<OrdemServico | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const initialFormData = {
    clienteId: '',
    clienteNome: '',
    veiculoId: '',
    status: 'Aberta' as OrdemServico['status'],
    tecnicoResponsavel: config?.tecnicoPadrao || '',
    descricao: '',
    fotos: [] as string[],
    quilometragemInicial: '',
    quilometragemFinal: '',
    observacoes: '',
    dataAbertura: '',
    dataTermino: '',
    valorTotal: 0,
    pecas: [] as PecaUtilizada[]
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!user) return;

    let unsubscribeClientes = () => {};
    let unsubscribeVeiculos = () => {};
    let unsubscribeOS = () => {};
    let unsubscribeConfig = () => {};
    let unsubscribePecas = () => {};

    const initDb = async () => {
      // Fetch Clientes
      unsubscribeClientes = await dbService.list('clientes', user.uid, (docs) => {
        setClientes(docs as Cliente[]);
      });

      // Fetch Veiculos
      unsubscribeVeiculos = await dbService.list('veiculos', user.uid, (docs) => {
        setVeiculos(docs as Veiculo[]);
      });

      // Fetch OS
      unsubscribeOS = await dbService.list('ordens_servico', user.uid, (docs) => {
        setOrdens(docs as OrdemServico[]);
        setLoading(false);
      });

      // Fetch Config
      unsubscribeConfig = await dbService.list('configuracoes', user.uid, (docs) => {
        if (docs.length > 0) {
          setConfig(docs[0]);
        }
      });

      // Fetch Peças
      unsubscribePecas = await dbService.list('pecas', user.uid, (docs) => {
        setPecasDb(docs);
      });
    };

    initDb();
    return () => {
      unsubscribeClientes();
      unsubscribeVeiculos();
      unsubscribeOS();
      unsubscribeConfig();
      unsubscribePecas();
    };
  }, [user]);

  useEffect(() => {
    if (openCreateSignal === 0) return;

    setEditingOS(null);
    setFormData({
      ...initialFormData,
      tecnicoResponsavel: config?.tecnicoPadrao || '',
      dataAbertura: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  }, [openCreateSignal, config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    const path = 'ordens_servico';
    try {
      // If a client was selected from the list, ensure we have their ID
      const selectedCliente = clientes.find(c => c.nome === formData.clienteNome);
      const finalClienteId = selectedCliente ? selectedCliente.id : formData.clienteId;

      const dataToSave = {
        ...formData,
        clienteId: finalClienteId,
        uid: user.uid,
        dataAbertura: formData.dataAbertura || new Date().toISOString()
      };

      if (editingOS) {
        await dbService.update(path, editingOS.id, dataToSave);
        toast.success('Ordem de Serviço atualizada com sucesso!');
      } else {
        const year = new Date().getFullYear();
        // Find the highest number for the current year to ensure uniqueness
        const yearPrefix = `OS-${year}`;
        const yearOrdens = ordens.filter(o => o.numero.startsWith(yearPrefix));
        const maxNum = yearOrdens.reduce((max, o) => {
          const parts = o.numero.split('-');
          const num = parts.length === 3 ? parseInt(parts[2]) : 0;
          return !isNaN(num) && num > max ? num : max;
        }, 0);
        
        const numero = `${yearPrefix}-${String(maxNum + 1).padStart(3, '0')}`;

        await dbService.create(path, {
          ...dataToSave,
          numero
        });
        toast.success('Ordem de Serviço aberta com sucesso!');
      }
      setIsModalOpen(false);
      setEditingOS(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error saving OS:', error);
      toast.error('Erro ao salvar Ordem de Serviço.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (os: OrdemServico) => {
    setEditingOS(os);
    const cliente = clientes.find(c => c.id === os.clienteId);
    setFormData({
      clienteId: os.clienteId,
      clienteNome: os.clienteNome || cliente?.nome || '',
      veiculoId: os.veiculoId,
      status: os.status,
      tecnicoResponsavel: os.tecnicoResponsavel || '',
      descricao: os.descricao,
      fotos: os.fotos || [],
      quilometragemInicial: os.quilometragemInicial || '',
      quilometragemFinal: os.quilometragemFinal || '',
      observacoes: os.observacoes || '',
      dataAbertura: os.dataAbertura?.toDate ? os.dataAbertura.toDate().toISOString().split('T')[0] : (typeof os.dataAbertura === 'string' ? os.dataAbertura.split('T')[0] : ''),
      dataTermino: os.dataTermino || '',
      valorTotal: os.valorTotal,
      pecas: os.pecas || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    setIsDeleting(true);
    const path = 'ordens_servico';
    try {
      await dbService.delete(path, deletingId, user.uid);
      toast.success('Ordem de Serviço excluída com sucesso!');
      setDeletingId(null);
    } catch (error) {
      console.error('Error deleting OS:', error);
      toast.error('Erro ao excluir Ordem de Serviço.');
    } finally {
      setIsDeleting(false);
    }
  };

  const generatePDF = (os: OrdemServico, shouldDownload = true) => {
    const doc = new jsPDF();
    const cliente = clientes.find(c => c.id === os.clienteId);
    const veiculo = veiculos.find(v => v.id === os.veiculoId);
    const fileName = `OS_${os.numero || 'S-N'}.pdf`;
    
    const margin = 10;
    const pageWidth = doc.internal.pageSize.width;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // Helper for drawing boxes
    const drawBox = (y: number, height: number, title?: string) => {
      doc.setDrawColor(0);
      doc.setLineWidth(0.2);
      doc.rect(margin, y, contentWidth, height);
      if (title) {
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, contentWidth, 6, 'F');
        doc.rect(margin, y, contentWidth, 6, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(title.toUpperCase(), margin + 2, y + 4);
      }
    };

    // 1. HEADER BOX
    const headerHeight = 30;
    drawBox(currentY, headerHeight);
    
    // Logo
    if (config?.logo && config?.exibirLogoNoPdf !== false) {
      try {
        // Try to detect format or default to PNG
        const format = config.logo.includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(config.logo, format, margin + 2, currentY + 2, 26, 26);
      } catch (e) {
        console.error('Error adding logo', e);
      }
    }

    // Provider Info
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados do Prestador', margin + 32, currentY + 4);
    doc.setFontSize(8);
    doc.text(config?.nomeOficina || 'NOME DA OFICINA', margin + 32, currentY + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(`CPF/CNPJ: ${config?.cnpj || ''}`, margin + 32, currentY + 13);
    doc.text(`Inscrição Municipal: ${config?.inscricaoMunicipal || ''}`, margin + 75, currentY + 13);
    doc.text(`Inscrição Estadual: ${config?.inscricaoEstadual || ''}`, margin + 120, currentY + 13);
    
    doc.text(`End.: ${config?.endereco || ''}, ${config?.complemento || ''}`, margin + 32, currentY + 17);
    doc.text(`Cidade: ${config?.cidade || ''} - ${config?.uf || ''}`, margin + 32, currentY + 21);
    doc.text(`Telefone: ${config?.telefone || ''}`, margin + 75, currentY + 21);
    doc.text(`Email: ${config?.email || ''}`, margin + 110, currentY + 21);

    // OS Number
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Nº OS', margin + 160, currentY + 10);
    doc.setFontSize(14);
    doc.text(os.numero || 'S/N', margin + 160, currentY + 18);

    currentY += headerHeight + 2;

    // 2. CUSTOMER & EQUIPMENT ROW
    const row2Height = 25;
    // Customer Box (Left)
    const col1Width = contentWidth * 0.65;
    doc.rect(margin, currentY, col1Width, row2Height);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, currentY, col1Width, 5, 'F');
    doc.rect(margin, currentY, col1Width, 5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('Dados do Tomador de Serviço', margin + 2, currentY + 3.5);

    doc.setFontSize(6);
    doc.text('Razão Social', margin + 2, currentY + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(cliente?.nome || '', margin + 2, currentY + 11);

    doc.setFont('helvetica', 'bold');
    doc.text('CNPJ/CPF', margin + 2, currentY + 15);
    doc.text('Inscrição Estadual', margin + 40, currentY + 15);
    doc.text('Inscrição Municipal', margin + 80, currentY + 15);
    
    doc.setFont('helvetica', 'normal');
    doc.text(cliente?.cpf_cnpj || '', margin + 2, currentY + 18);
    doc.text(cliente?.inscricao_estadual || '', margin + 40, currentY + 18);
    doc.text(cliente?.inscricao_municipal || '', margin + 80, currentY + 18);

    doc.setFont('helvetica', 'bold');
    doc.text('Endereço', margin + 2, currentY + 22);
    doc.text('Cidade', margin + 60, currentY + 22);
    doc.text('UF', margin + 95, currentY + 22);
    doc.text('Telefone', margin + 105, currentY + 22);

    doc.setFont('helvetica', 'normal');
    const endereco = `${cliente?.logradouro || ''}, ${cliente?.numero || ''} ${cliente?.bairro || ''}`;
    doc.text(endereco, margin + 2, currentY + 24);
    doc.text(cliente?.cidade || '', margin + 60, currentY + 24);
    doc.text(cliente?.uf || '', margin + 95, currentY + 24);
    doc.text(cliente?.telefone || '', margin + 105, currentY + 24);

    // Equipment Box (Right)
    const col2X = margin + col1Width;
    const col2Width = contentWidth - col1Width;
    doc.rect(col2X, currentY, col2Width, row2Height);
    doc.setFillColor(240, 240, 240);
    doc.rect(col2X, currentY, col2Width, 5, 'F');
    doc.rect(col2X, currentY, col2Width, 5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO EQUIPAMENTO / MÁQUINA', col2X + 2, currentY + 3.5);

    doc.setFontSize(6);
    doc.text(`Marca: ${veiculo?.marca || ''}`, col2X + 2, currentY + 8);
    doc.text(`Modelo: ${veiculo?.modelo || ''}`, col2X + 25, currentY + 8);
    doc.text(`Ano: ${veiculo?.ano || ''}`, col2X + 50, currentY + 8);
    doc.text(`Número de Série: ${veiculo?.placa_serie || ''}`, col2X + 2, currentY + 13);
    doc.text(`Horímetro / KM: ${os.quilometragemInicial || ''}`, col2X + 2, currentY + 18);
    doc.text(`Implemento / Máquina: ${veiculo?.tipo || ''}`, col2X + 2, currentY + 23);

    currentY += row2Height + 2;

    // 3. SERVICE DESCRIPTION
    const descHeight = 40;
    drawBox(currentY, descHeight, 'Descrição dos Serviços');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const descLines = doc.splitTextToSize(os.descricao || '', contentWidth - 4);
    doc.text(descLines, margin + 2, currentY + 10);

    // Total Value inside description box at bottom
    doc.setFont('helvetica', 'bold');
    const totalValue = typeof os.valorTotal === 'number' ? os.valorTotal : 0;
    const totalText = `VALOR TOTAL DA OS: R$ ${formatNumber(totalValue)}`;
    doc.text(totalText, margin + contentWidth - 2, currentY + descHeight - 4, { align: 'right' });

    currentY += descHeight + 2;

    // 4. PARTS TABLE
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bolditalic');
    doc.text('Peças Utilizadas', margin, currentY + 4);
    doc.setFont('helvetica', 'normal');
    currentY += 6;

    const tableHeaders = [['Item', 'Código', 'Descrição', 'Qtde', 'Valor Unit', 'Total']];
    const tableData = (os.pecas || []).map(p => [
      p.item || '',
      p.codigo || '',
      p.descricao || '',
      p.quantidade || 0,
      formatNumber(p.valorUnitario || 0),
      formatNumber(p.total || 0)
    ]);

    // Fill with empty rows if needed to match layout feel
    while (tableData.length < 3) {
      tableData.push(['', '', '', '', '', '']);
    }

    autoTable(doc, {
      startY: currentY,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable?.finalY || (currentY + 20);
    currentY += 2;

    // 5. PHOTOS BOX
    if (config?.exibirFotosNoPdf !== false) {
      const photosHeight = 35;
      drawBox(currentY, photosHeight, 'FOTOS');
      if (os.fotos && os.fotos.length > 0) {
        let xPos = margin + 2;
        const imgW = 30;
        const imgH = 25;
        os.fotos.slice(0, 5).forEach((foto) => {
          try {
            const format = foto.includes('png') ? 'PNG' : 'JPEG';
            doc.addImage(foto, format, xPos, currentY + 8, imgW, imgH);
            xPos += imgW + 2;
          } catch (e) {}
        });
      }
      currentY += photosHeight + 5;
    }

    // 6. WARRANTY TERM
    if (config?.termoGarantia) {
      doc.rect(margin, currentY, contentWidth, 15);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Termo de garantia:', margin + 2, currentY + 6);
      const termoLines = doc.splitTextToSize(config.termoGarantia, contentWidth - 35);
      doc.text(termoLines, margin + 32, currentY + 6);
      currentY += 25;
    } else {
      currentY += 5;
    }

    // 7. SIGNATURE
    doc.setLineWidth(0.5);
    doc.line(margin + 110, currentY, margin + 180, currentY);
    doc.setFontSize(8);
    doc.text(os.tecnicoResponsavel || 'Técnico Responsável', margin + 145, currentY + 4, { align: 'center' });
    doc.setFontSize(7);
    doc.text('Assinatura do Técnico Responsável', margin + 145, currentY + 8, { align: 'center' });

    if (user?.uid) {
      void pdfArchiveService.saveGeneratedPdf({
        uid: user.uid,
        recordType: 'ordem_servico',
        recordId: os.id,
        fileName,
        doc,
      }).catch((error) => {
        console.error('Erro ao arquivar PDF da ordem de serviço:', error);
      });
    }

    if (shouldDownload) {
      void pdfOpenService.openPdf(doc, fileName).catch((error) => {
        console.error('Erro ao abrir PDF da ordem de serviço:', error);
        toast.error('Não foi possível abrir o PDF neste dispositivo.');
      });
    }
    return doc;
  };

  const sendWhatsApp = (os: OrdemServico) => {
    const cliente = clientes.find(c => c.id === os.clienteId);
    if (!cliente?.telefone) {
      toast.error('Cliente sem telefone cadastrado.');
      return;
    }
    const veiculo = veiculos.find(v => v.id === os.veiculoId);
    const message = `Olá ${cliente.nome}, sua Ordem de Serviço ${os.numero} para o veículo ${veiculo?.marca} ${veiculo?.modelo} está com status: ${os.status}. Valor total: ${formatCurrency(os.valorTotal)}.`;
    const encodedMessage = encodeURIComponent(message);
    const phone = cliente.telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}?text=${encodedMessage}`, '_blank');
  };

  const sendEmail = async (os: OrdemServico) => {
    const cliente = clientes.find(c => c.id === os.clienteId);
    if (!cliente?.email) {
      toast.error('Cliente sem e-mail cadastrado.');
      return;
    }

    const doc = generatePDF(os, false);
    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    const file = new File([pdfArrayBuffer], `OS_${os.numero}.pdf`, { type: 'application/pdf' });

    const googleTokens = googleService.getTokens();
    
    if (googleTokens) {
      const toastId = toast.loading('Preparando e-mail...');
      try {
        const veiculo = veiculos.find(v => v.id === os.veiculoId);
        const subject = `Ordem de Serviço ${os.numero} - ${config?.nomeOficina || 'Oficina'}`;
        const body = `Olá ${cliente.nome},\n\nSeguem as informações da sua Ordem de Serviço:\n\nNúmero: ${os.numero}\nVeículo: ${veiculo?.marca} ${veiculo?.modelo}\nStatus: ${os.status}\nValor Total: ${formatCurrency(os.valorTotal)}\n\nAtenciosamente,\nEquipe ${config?.nomeOficina || 'Oficina'}`;

        // Check file size (approx 20MB limit for Gmail API via JSON)
        if (pdfArrayBuffer.byteLength > 15 * 1024 * 1024) {
          toast.error('O arquivo é muito grande para enviar por e-mail (limite 15MB). Tente remover algumas fotos.', { id: toastId });
          return;
        }

        toast.loading('Enviando via Gmail...', { id: toastId });
        await googleService.sendEmail(googleTokens, {
          to: cliente.email,
          subject,
          body,
          attachments: [
            {
              filename: `OS_${os.numero}.pdf`,
              mimeType: 'application/pdf',
              content: pdfBase64
            }
          ]
        });
        toast.success('E-mail enviado com sucesso via Gmail!', { id: toastId });
        return;
      } catch (error: any) {
        console.error('Error sending via Gmail:', error);
        const errorMsg = error.message?.includes('413') ? 'Arquivo muito grande para o servidor.' : 'Erro na conexão com o Google.';
        toast.error(`${errorMsg} Tentando método alternativo...`, { id: toastId });
      }
    } else {
      toast.error('Google não conectado. Conecte em Configurações > Integrações.');
    }

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Ordem de Serviço ${os.numero}`,
          text: `Olá ${cliente.nome}, segue em anexo a sua Ordem de Serviço ${os.numero}.`,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing', error);
          toast.error('Erro ao compartilhar o PDF.');
        }
      }
    } else {
      // Fallback for browsers that don't support file sharing
      const veiculo = veiculos.find(v => v.id === os.veiculoId);
      const subject = encodeURIComponent(`Ordem de Serviço ${os.numero} - ${config?.nomeOficina || 'Oficina'}`);
      const body = encodeURIComponent(`Olá ${cliente.nome},\n\nSeguem as informações da sua Ordem de Serviço:\n\nNúmero: ${os.numero}\nVeículo: ${veiculo?.marca} ${veiculo?.modelo}\nStatus: ${os.status}\nValor Total: ${formatCurrency(os.valorTotal)}\n\nO PDF foi baixado para que você possa anexá-lo manualmente.`);
      
      window.open(`mailto:${cliente.email}?subject=${subject}&body=${body}`, '_blank');
      generatePDF(os, true); // Download as fallback
      toast.success('PDF baixado. Anexe-o manualmente ao e-mail.');
    }
  };

  const getClienteNome = (id: string, os?: OrdemServico) => {
    if (os?.clienteNome) return os.clienteNome;
    return clientes.find(c => c.id === id)?.nome || 'N/A';
  };

  const getVeiculoModelo = (id: string) => {
    const v = veiculos.find(v => v.id === id);
    return v ? `${v.marca} ${v.modelo}` : 'N/A';
  };

  const filteredOrdens = ordens.filter(os => 
    os.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getClienteNome(os.clienteId, os).toLowerCase().includes(searchTerm.toLowerCase()) ||
    getVeiculoModelo(os.veiculoId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: OrdemServico['status']) => {
    switch (status) {
      case 'Aberta': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Em Andamento': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Aguardando Peças': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Finalizada': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Cancelada': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: OrdemServico['status']) => {
    switch (status) {
      case 'Aberta': return <FileText className="w-4 h-4" />;
      case 'Em Andamento': return <Clock className="w-4 h-4" />;
      case 'Aguardando Peças': return <AlertCircle className="w-4 h-4" />;
      case 'Finalizada': return <CheckCircle2 className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setFormData(prev => ({
          ...prev,
          fotos: [...prev.fotos, base64String]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const handleTakePhoto = async () => {
    try {
      const photo = await photoCaptureService.takePhoto();
      setFormData((prev) => ({
        ...prev,
        fotos: [...prev.fotos, photo]
      }));
    } catch (error) {
      if (!photoCaptureService.isUserCancellationError(error)) {
        console.error('Erro ao abrir câmera:', error);
        toast.error('Não foi possível abrir a câmera.');
      }
    }
  };

  const handlePickPhotos = async () => {
    try {
      const photos = await photoCaptureService.pickPhotos();
      if (photos.length === 0) {
        return;
      }

      setFormData((prev) => ({
        ...prev,
        fotos: [...prev.fotos, ...photos]
      }));
    } catch (error) {
      if (!photoCaptureService.isUserCancellationError(error)) {
        console.error('Erro ao abrir galeria:', error);
        toast.error('Não foi possível abrir a galeria.');
      }
    }
  };

  const removeFoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      fotos: prev.fotos.filter((_, i) => i !== index)
    }));
  };

  const addPeca = () => {
    const newPeca: PecaUtilizada = {
      item: formData.pecas.length + 1,
      codigo: '',
      descricao: '',
      quantidade: 1,
      valorUnitario: 0,
      total: 0
    };
    setFormData(prev => ({
      ...prev,
      pecas: [...prev.pecas, newPeca]
    }));
  };

  const updatePeca = (index: number, field: keyof PecaUtilizada, value: any) => {
    const newPecas = [...formData.pecas];
    let peca = { ...newPecas[index], [field]: value };
    
    // Auto-fill if description matches a part in DB
    if (field === 'descricao') {
      const dbPeca = pecasDb.find(p => p.descricao === value);
      if (dbPeca) {
        peca = {
          ...peca,
          codigo: dbPeca.codigo,
          valorUnitario: dbPeca.precoVenda,
          total: (peca.quantidade || 1) * dbPeca.precoVenda
        };
      }
    }

    if (field === 'quantidade' || field === 'valorUnitario') {
      peca.total = (peca.quantidade || 0) * (peca.valorUnitario || 0);
    }
    
    newPecas[index] = peca;
    
    // Update total OS value
    const newTotal = newPecas.reduce((acc, p) => acc + (p.total || 0), 0);
    
    setFormData(prev => ({
      ...prev,
      pecas: newPecas,
      valorTotal: newTotal
    }));
  };

  const removePeca = (index: number) => {
    const newPecas = formData.pecas.filter((_, i) => i !== index).map((p, i) => ({ ...p, item: i + 1 }));
    const newTotal = newPecas.reduce((acc, p) => acc + (p.total || 0), 0);
    setFormData(prev => ({
      ...prev,
      pecas: newPecas,
      valorTotal: newTotal
    }));
  };

  const handlePecaCurrencyInput = (index: number, field: keyof PecaUtilizada, value: number) => {
    updatePeca(index, field, value);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Ordens de Serviço</h1>
          <p className="text-slate-500 mt-1 font-medium">Acompanhe e gerencie todos os serviços da oficina.</p>
        </div>
        <button 
          onClick={() => {
          setEditingOS(null);
          setFormData({
            ...initialFormData,
            tecnicoResponsavel: config?.tecnicoPadrao || '',
            dataAbertura: new Date().toISOString().split('T')[0]
          });
          setIsModalOpen(true);
        }}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 font-semibold"
        >
          <Plus className="w-5 h-5" />
          Nova OS
        </button>
      </header>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por número, cliente ou equipamento..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm text-sm">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">OS / Data</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Equipamento</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrdens.map((os) => (
                  <tr key={os.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">{os.numero}</span>
                        <span className="text-xs text-slate-400">{new Date(os.dataAbertura).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">{getClienteNome(os.clienteId, os)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{getVeiculoModelo(os.veiculoId)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(os.status)}`}>
                        {getStatusIcon(os.status)}
                        {os.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-emerald-600">
                        {formatCurrency(os.valorTotal)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => generatePDF(os)}
                          className="p-2 hover:bg-emerald-50 rounded-lg transition-colors text-slate-400 hover:text-emerald-600"
                          title="Imprimir PDF"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => sendWhatsApp(os)}
                          className="p-2 hover:bg-green-50 rounded-lg transition-colors text-slate-400 hover:text-green-600"
                          title="Enviar WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => sendEmail(os)}
                          className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-slate-400 hover:text-blue-500"
                          title="Enviar E-mail"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEdit(os)}
                          className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-slate-400 hover:text-blue-600"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeletingId(os.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {!loading && filteredOrdens.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-slate-400 font-medium">Nenhuma ordem de serviço encontrada.</p>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingOS(null);
          setFormData(initialFormData);
        }} 
        title={editingOS ? "Editar Ordem de Serviço" : "Abrir Nova Ordem de Serviço"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Cliente</label>
              <div className="relative">
                <input 
                  list="clientes-list"
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Digite o nome do cliente ou selecione..."
                  value={formData.clienteNome}
                  onChange={e => {
                    const nome = e.target.value;
                    const cliente = clientes.find(c => c.nome === nome);
                    setFormData({
                      ...formData, 
                      clienteNome: nome,
                      clienteId: cliente ? cliente.id : '',
                      veiculoId: cliente ? formData.veiculoId : '' // Reset vehicle if client changes and not found
                    });
                  }}
                />
                <datalist id="clientes-list">
                  {clientes.map(c => (
                    <option key={c.id} value={c.nome} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Equipamento</label>
              <select 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={formData.veiculoId}
                onChange={e => setFormData({...formData, veiculoId: e.target.value})}
              >
                <option value="">Selecione um equipamento</option>
                {veiculos
                  .filter(v => !formData.clienteId || v.clienteId === formData.clienteId)
                  .map(v => (
                    <option key={v.id} value={v.id}>{v.marca} {v.modelo} ({v.placa_serie})</option>
                  ))
                }
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Status Inicial</label>
              <select 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as OrdemServico['status']})}
              >
                <option value="Aberta">Aberta</option>
                <option value="Em Andamento">Em Andamento</option>
                <option value="Aguardando Peças">Aguardando Peças</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Técnico Responsável</label>
              <input 
                required 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Nome do mecânico" 
                value={formData.tecnicoResponsavel}
                onChange={e => setFormData({...formData, tecnicoResponsavel: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Valor Estimado (R$)</label>
              <CurrencyInput 
                required 
                value={formData.valorTotal}
                onChange={val => setFormData({...formData, valorTotal: val})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-right font-bold" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">KM/Horas Inicial</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: 1500" 
                value={formData.quilometragemInicial}
                onChange={e => setFormData({...formData, quilometragemInicial: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">KM/Horas Final</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Ex: 1550" 
                value={formData.quilometragemFinal}
                onChange={e => setFormData({...formData, quilometragemFinal: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Data de Início</label>
              <input 
                type="date" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                value={formData.dataAbertura || ''}
                onChange={e => setFormData({...formData, dataAbertura: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Data de Término</label>
              <input 
                type="date" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                value={formData.dataTermino || ''}
                onChange={e => setFormData({...formData, dataTermino: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Peças Utilizadas</label>
                <button 
                  type="button"
                  onClick={addPeca}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all"
                >
                  <Plus className="w-3 h-3" />
                  Adicionar Peça
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Código</th>
                      <th className="px-4 py-2">Descrição</th>
                      <th className="px-4 py-2 text-center">Qtde</th>
                      <th className="px-4 py-2 text-right">Valor Unit.</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formData.pecas.map((peca, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2 font-medium text-slate-400">{peca.item}</td>
                        <td className="px-4 py-2">
                          <input 
                            type="text"
                            value={peca.codigo}
                            onChange={e => updatePeca(idx, 'codigo', e.target.value)}
                            className="w-full bg-transparent focus:outline-none"
                            placeholder="Cód."
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text"
                            list="pecas-db-list"
                            value={peca.descricao}
                            onChange={e => updatePeca(idx, 'descricao', e.target.value)}
                            className="w-full bg-transparent focus:outline-none"
                            placeholder="Nome da peça"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input 
                            type="number"
                            value={peca.quantidade}
                            onChange={e => updatePeca(idx, 'quantidade', parseFloat(e.target.value))}
                            className="w-16 bg-transparent text-center focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <CurrencyInput 
                            value={peca.valorUnitario}
                            onChange={val => handlePecaCurrencyInput(idx, 'valorUnitario', val)}
                            className="w-24 bg-transparent text-right focus:outline-none font-medium"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-slate-700">
                          {formatNumber(peca.total)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button 
                            type="button"
                            onClick={() => removePeca(idx)}
                            className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {formData.pecas.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 italic">
                          Nenhuma peça adicionada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Descrição do Problema / Serviço</label>
              <textarea 
                required 
                rows={4}
                spellCheck={true}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Descreva detalhadamente o serviço a ser realizado..." 
                value={formData.descricao}
                onChange={e => setFormData({...formData, descricao: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Observações Adicionais</label>
              <textarea 
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all" 
                placeholder="Observações internas ou para o cliente..." 
                value={formData.observacoes}
                onChange={e => setFormData({...formData, observacoes: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">Fotos do Serviço</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {formData.fotos.map((foto, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200">
                    <img src={foto} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <button 
                      type="button"
                      onClick={() => removeFoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {/* Botão Câmera */}
                <button type="button" onClick={handleTakePhoto} className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-all">
                  <Camera className="w-8 h-8 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">Câmera</span>
                </button>

                {/* Botão Galeria */}
                <button type="button" onClick={handlePickPhotos} className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-all">
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">Galeria</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button 
              type="button"
              disabled={isSaving}
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Abrir Ordem de Serviço
            </button>
          </div>
        </form>
        <datalist id="pecas-db-list">
          {pecasDb.map(p => (
            <option key={p.id} value={p.descricao}>{p.codigo} - {p.marca}</option>
          ))}
        </datalist>
      </Modal>

      <Modal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Confirmar Exclusão"
      >
        <div className="space-y-6">
          <p className="text-slate-600">
            Tem certeza que deseja excluir esta ordem de serviço? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeletingId(null)}
              className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
