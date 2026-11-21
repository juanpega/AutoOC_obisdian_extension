import {deflateRawSync} from 'node:zlib';

const crcTable=Uint32Array.from({length:256},(_,value)=>{
  for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;
  return value>>>0;
});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}

/** Classic ZIP, UTF-8 names, DEFLATE and fixed timestamps. No shell or external tools. */
export function zipArchive(entries){
  if(!entries.length || entries.length>65535)throw new Error('Unsupported ZIP entry count');
  const names=new Set(),local=[],central=[];let offset=0,centralSize=0;
  for(const {name,data} of entries){
    if(typeof name!=='string' || !name || /[\\:\0]/.test(name) || name.split('/').some(part=>!part || part==='.' || part==='..') || names.has(name))throw new Error('Unsafe or duplicate ZIP path');
    names.add(name);
    const filename=Buffer.from(name,'utf8'),bytes=Buffer.from(data),compressed=deflateRawSync(bytes,{level:9}),crc=crc32(bytes);
    if(filename.length>65535 || bytes.length>0xffffffff || compressed.length>0xffffffff)throw new Error('ZIP64 is not supported');
    const header=Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50,0);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);
    header.writeUInt16LE(8,8);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);
    header.writeUInt32LE(compressed.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
    local.push(header,filename,compressed);
    const record=Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50,0);record.writeUInt16LE(20,4);record.writeUInt16LE(20,6);
    record.writeUInt16LE(0x800,8);record.writeUInt16LE(8,10);record.writeUInt16LE(33,14);record.writeUInt32LE(crc,16);
    record.writeUInt32LE(compressed.length,20);record.writeUInt32LE(bytes.length,24);record.writeUInt16LE(filename.length,28);
    record.writeUInt32LE(offset,42);central.push(record,filename);
    offset+=header.length+filename.length+compressed.length;centralSize+=record.length+filename.length;
    if(offset+centralSize>0xffffffff)throw new Error('ZIP64 is not supported');
  }
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,...central,end]);
}
