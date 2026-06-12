import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';

export function CardForm({ 
  onValidData 
}: { 
  onValidData: (valid: boolean, maskedCard: string) => void 
}) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  
  const [errors, setErrors] = useState<any>({});
  
  const getCardType = (num: string) => {
    if (num.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(num)) return 'Mastercard';
    if (/^(34|37)/.test(num)) return 'American Express';
    if (/^(60|65|81|82|508)/.test(num)) return 'RuPay';
    return '';
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (val.length > 16) val = val.substring(0, 16);
    
    // exact spaces
    const parts = [];
    for (let i = 0; i < val.length; i += 4) {
      parts.push(val.substring(i, i + 4));
    }
    setCardNumber(parts.join(' '));
  };
  
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (val.length >= 2) {
      val = val.substring(0, 2) + '/' + val.substring(2, 4);
    }
    setExpiry(val);
  };
  
  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (val.length > 3) val = val.substring(0, 3);
    setCvv(val);
  };
  
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
    if (val.length <= 50) {
      setCardName(val);
    }
  };

  useEffect(() => {
    const newErrors: any = {};
    let isValid = true;
    
    const rawCardNumber = cardNumber.replace(/\s+/g, '');
    if (rawCardNumber.length > 0 && rawCardNumber.length !== 16) {
      newErrors.cardNumber = 'Card Number must contain exactly 16 digits';
      isValid = false;
    } else if (rawCardNumber.length !== 16) {
      isValid = false;
    }
    
    if (cardName.length > 0 && (cardName.trim().length < 3)) {
      newErrors.cardName = 'Enter valid cardholder name';
      isValid = false;
    } else if (cardName.trim().length < 3) {
      isValid = false;
    }
    
    if (expiry.length > 0) {
      const [mm, yy] = expiry.split('/');
      if (!mm || !yy || mm.length !== 2 || yy.length !== 2) {
        newErrors.expiry = 'Enter a valid expiry date';
        isValid = false;
      } else {
        const month = parseInt(mm, 10);
        const year = parseInt(`20${yy}`, 10);
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        if (month < 1 || month > 12 || (year < currentYear) || (year === currentYear && month < currentMonth)) {
          newErrors.expiry = 'Enter a valid expiry date';
          isValid = false;
        }
      }
    } else {
      isValid = false;
    }
    
    if (cvv.length > 0 && cvv.length !== 3) {
      newErrors.cvv = 'CVV must contain exactly 3 digits';
      isValid = false;
    } else if (cvv.length !== 3) {
      isValid = false;
    }
    
    setErrors(newErrors);
    
    if (isValid) {
      const masked = `XXXX XXXX XXXX ${rawCardNumber.substring(12)}`;
      onValidData(true, masked);
    } else {
      onValidData(false, '');
    }
  }, [cardNumber, cardName, expiry, cvv]);

  const ct = getCardType(cardNumber.replace(/\s+/g, ''));

  return (
    <div className="bg-[#0A0B0D] p-5 rounded-2xl border border-white/5 space-y-4 mt-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">
        <CreditCard className="w-4 h-4" /> Card Details
        {ct && <span className="ml-auto text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-xs">{ct}</span>}
      </h4>
      
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Card Number *</label>
        <input
          type="text"
          value={cardNumber}
          onChange={handleCardNumberChange}
          placeholder="XXXX XXXX XXXX XXXX"
          className={`w-full bg-[#16191F] border ${errors.cardNumber ? 'border-red-500/50' : 'border-white/5'} rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white placeholder:text-gray-600`}
        />
        {errors.cardNumber && <div className="text-red-400 text-xs mt-1">{errors.cardNumber}</div>}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Cardholder Name *</label>
        <input
          type="text"
          value={cardName}
          onChange={handleNameChange}
          placeholder="Name on card"
          className={`w-full bg-[#16191F] border ${errors.cardName ? 'border-red-500/50' : 'border-white/5'} rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white placeholder:text-gray-600`}
        />
        {errors.cardName && <div className="text-red-400 text-xs mt-1">{errors.cardName}</div>}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date *</label>
          <input
            type="text"
            value={expiry}
            onChange={handleExpiryChange}
            placeholder="MM/YY"
            className={`w-full bg-[#16191F] border ${errors.expiry ? 'border-red-500/50' : 'border-white/5'} rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white placeholder:text-gray-600`}
          />
          {errors.expiry && <div className="text-red-400 text-xs mt-1">{errors.expiry}</div>}
        </div>
        
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">CVV *</label>
          <input
            type="password"
            value={cvv}
            onChange={handleCvvChange}
            placeholder="***"
            className={`w-full bg-[#16191F] border ${errors.cvv ? 'border-red-500/50' : 'border-white/5'} rounded-xl py-3 px-4 focus:border-blue-500 focus:outline-none transition-colors text-white placeholder:text-gray-600 tracking-[0.2em]`}
          />
          {errors.cvv && <div className="text-red-400 text-xs mt-1">{errors.cvv}</div>}
        </div>
      </div>
    </div>
  );
}
