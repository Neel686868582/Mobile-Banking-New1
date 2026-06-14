import { useState } from 'react';
import { formatINR } from '../lib/utils';
import { Clock, Search, ArrowDownLeft, ArrowUpRight, ReceiptText, Target, PlusCircle, MinusCircle, CheckCircle2, Download, X, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as htmlToImage from 'html-to-image';
import { toast } from 'react-hot-toast';
import { jsPDF } from "jspdf";

const icons: any = {
  ArrowDownLeft, ArrowUpRight, FileText: ReceiptText, Target, PlusCircle, MinusCircle, Zap
};

export function History({ transactions }: { transactions: any[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');
  const [selectedTx, setSelectedTx] = useState<any>(null);

  const filtered = transactions.filter(tx => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (search && !tx.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const dA = new Date(a.date).getTime();
    const dB = new Date(b.date).getTime();
    return sort === 'desc' ? dB - dA : dA - dB;
  });

  const handleDownloadReceipt = async () => {
    if (!selectedTx) return;
    
    // Generate special PDF for electricity bills
    if (selectedTx.electricityBillDetails) {
      try {
        const doc = new jsPDF();
        
        doc.setFillColor(37, 99, 235); // Blue-600
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("ELECTRICITY BILL RECEIPT", 105, 25, { align: "center" });
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        
        let yPos = 60;
        
        const addRow = (label: string, value: string) => {
          doc.setFont("helvetica", "bold");
          doc.text(label + ":", 20, yPos);
          doc.setFont("helvetica", "normal");
          doc.text(value, 80, yPos);
          yPos += 10;
        };
        
        const details = selectedTx.electricityBillDetails;
        
        addRow("Provider Name", details.providerName);
        addRow("Consumer Name", details.consumerName);
        addRow("Consumer Number", details.consumerNumber);
        addRow("Transaction ID", selectedTx.id);
        addRow("Billing Month", details.billingMonth);
        addRow("Due Date", details.dueDate);
        
        yPos += 5;
        doc.line(20, yPos, 190, yPos);
        yPos += 10;
        
        addRow("Payment Method", selectedTx.method || 'System Internal');
        addRow("Date & Time", new Date(selectedTx.date).toLocaleString());
        addRow("Payment Status", details.status);
        
        yPos += 5;
        doc.line(20, yPos, 190, yPos);
        yPos += 10;
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Total Paid:", 20, yPos);
        doc.text(`INR ${selectedTx.amount}`, 80, yPos);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text("Thank you for using RupeePay Utility Services.", 105, 280, { align: "center" });

        doc.save(`electricity_receipt_${selectedTx.id}.pdf`);
        toast.success("Receipt downloaded as PDF!");
        return;
      } catch (err: any) {
         toast.error(`Failed to download PDF: ${err.message}`);
         return;
      }
    }

    try {
      const element = document.getElementById('receipt-content-history');
      if (!element) return;
      
      const dataUrl = await htmlToImage.toJpeg(element, { 
        backgroundColor: '#16191F',
        pixelRatio: 2
      });
      
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `receipt_${selectedTx.id}.png`;
      a.click();
      toast.success("Receipt downloaded successfully!");
    } catch(err: any) {
      toast.error(`Failed to download receipt: ${err?.message || "Unknown error"}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-10">
      <div className="mb-8">
        <h2 className="text-3xl font-sans tracking-tight mb-2 flex items-center gap-3"><Clock className="text-blue-400" /> Transaction History</h2>
        <p className="text-gray-500">View and search through your past transactions.</p>
      </div>

      <div className="bg-[#16191F] border border-white/5 rounded-3xl p-8 shadow-xl">
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search by name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0A0B0D] border border-white/5 rounded-xl py-3 pl-12 pr-4 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-4">
            <select 
              value={filter} 
              onChange={e => setFilter(e.target.value as any)}
              className="bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none"
            >
              <option value="all">All Types</option>
              <option value="credit">Money In (Credit)</option>
              <option value="debit">Money Out (Debit)</option>
            </select>
            <select 
              value={sort} 
              onChange={e => setSort(e.target.value as any)}
              className="bg-[#0A0B0D] border border-white/5 rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors appearance-none"
            >
              <option value="desc">Latest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-dashed border-white/5 rounded-2xl">
              No transactions found matching your criteria.
            </div>
          ) : (
            filtered.map(tx => {
              const Icon = icons[tx.icon] || ReceiptText;
              return (
                <div 
                  key={tx.id} 
                  onClick={() => setSelectedTx(tx)}
                  className="flex items-center justify-between p-5 bg-[#0A0B0D] border border-white/5 hover:border-gray-700 transition-colors rounded-2xl group cursor-pointer"
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${tx.type === 'credit' ? 'bg-blue-600/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-medium text-lg text-gray-200">{tx.name}</div>
                      <div className="text-sm text-gray-500">{new Date(tx.date).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className={`font-semibold text-xl ${tx.type === 'credit' ? 'text-blue-400' : 'text-gray-200'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{formatINR(tx.amount)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
      
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedTx(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#16191F] border border-white/10 rounded-3xl shadow-2xl relative w-full max-w-md z-10 max-h-[90vh] flex flex-col overflow-hidden"
            >
              <button 
                onClick={() => setSelectedTx(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white bg-[#0A0B0D] p-2 rounded-full border border-white/5 transition-colors z-20 shadow-xl"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div id="receipt-content-history" className="p-6 pb-4 sm:p-8 sm:pb-4 relative mt-4 overflow-y-auto w-full">
                <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
                <div className="mt-2 mb-6 text-center">
                  <h1 className="text-xl font-bold text-gray-300">MOBILE BANKING</h1>
                </div>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-500/10 text-green-500">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-2 text-center">{formatINR(selectedTx.amount)}</h2>
                <p className="font-medium mb-8 text-center text-green-400">
                  {selectedTx.type === 'credit' ? 'Received' : 'Sent/Paid'} Successfully
                </p>
                
                <div className="bg-[#0A0B0D] rounded-2xl p-6 mb-2 text-sm text-left border border-white/5 space-y-4">
                  {selectedTx.electricityBillDetails ? (
                    <>
                      <div className="flex justify-between border-b border-white/5 pb-3">
                        <span className="text-gray-500">Provider Name</span>
                        <span className="font-medium text-right">{selectedTx.electricityBillDetails.providerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Consumer Name</span>
                        <span className="font-medium text-right">{selectedTx.electricityBillDetails.consumerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Consumer Number</span>
                        <span className="font-medium text-right">{selectedTx.electricityBillDetails.consumerNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Billing Month</span>
                        <span className="font-medium text-right">{selectedTx.electricityBillDetails.billingMonth}</span>
                      </div>
                      <div className="flex justify-between border-b border-white/5 pb-3">
                        <span className="text-gray-500">Due Date</span>
                        <span className="font-medium text-right">{selectedTx.electricityBillDetails.dueDate}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{selectedTx.type === 'credit' ? 'From' : 'To'}</span>
                        <span className="text-white font-medium text-right max-w-[150px] truncate">{selectedTx.toName || selectedTx.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Account / Source</span>
                        <span className="text-white">{selectedTx.toAcc || 'N/A'}</span>
                      </div>
                      {selectedTx.metadata && selectedTx.metadata.cardType && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Card</span>
                          <span className="text-white">
                            {selectedTx.metadata.cardType} {selectedTx.metadata.last4 ? `ends in ${selectedTx.metadata.last4}` : ''}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between border-t border-white/5 pt-4">
                    <span className="text-gray-500">Transaction ID</span>
                    <span className="text-white font-mono text-xs max-w-[150px] truncate" title={selectedTx.transactionId || selectedTx.id}>{selectedTx.transactionId || selectedTx.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date & Time</span>
                    <span className="text-white text-right max-w-[150px]">{new Date(selectedTx.date).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Method</span>
                    <span className="text-white text-right max-w-[150px]">{selectedTx.method || 'System Internal'}</span>
                  </div>
                  {selectedTx.electricityBillDetails && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment Status</span>
                      <span className="text-white font-semibold text-right max-w-[150px] text-green-400">{selectedTx.electricityBillDetails.status}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex gap-4 mt-6">
                <button 
                  onClick={handleDownloadReceipt}
                  className="w-full bg-[#232730] hover:bg-[#2A2F3A] text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5 text-blue-400" /> Download Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
