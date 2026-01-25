    const MARD_DB = [
        {id:'A1',hex:'#faf5cd'},{id:'A2',hex:'#fcfed6'},{id:'A3',hex:'#fcff92'},{id:'A4',hex:'#f7ec5c'},{id:'A5',hex:'#f0d83a'},{id:'A6',hex:'#fda951'},{id:'A7',hex:'#fa8c4f'},{id:'A8',hex:'#fbda4d'},{id:'A9',hex:'#f79d5f'},{id:'A10',hex:'#f47e38'},{id:'A11',hex:'#fedb99'},{id:'A12',hex:'#fda276'},{id:'A13',hex:'#fec667'},{id:'A14',hex:'#f75842'},{id:'A15',hex:'#fbf65e'},{id:'A16',hex:'#feff97'},{id:'A17',hex:'#fde173'},{id:'A18',hex:'#fcbf80'},{id:'A19',hex:'#fd7e77'},{id:'A20',hex:'#f9d66e'},{id:'A21',hex:'#fae393'},{id:'A22',hex:'#edf878'},{id:'A23',hex:'#e4c8ba'},{id:'A24',hex:'#f3f6a9'},{id:'A25',hex:'#ffd785'},{id:'A26',hex:'#ffc734'},
        {id:'B1',hex:'#dff13b'},{id:'B2',hex:'#64f343'},{id:'B3',hex:'#a1f586'},{id:'B4',hex:'#5fdf34'},{id:'B5',hex:'#39e158'},{id:'B6',hex:'#64e0a4'},{id:'B7',hex:'#3eae7c'},{id:'B8',hex:'#1d9b54'},{id:'B9',hex:'#2a5037'},{id:'B10',hex:'#9ad1ba'},{id:'B11',hex:'#627032'},{id:'B12',hex:'#1a6e3d'},{id:'B13',hex:'#c8e87d'},{id:'B14',hex:'#abe84f'},{id:'B15',hex:'#305335'},{id:'B16',hex:'#c0ed9c'},{id:'B17',hex:'#9eb33e'},{id:'B18',hex:'#e6ed4f'},{id:'B19',hex:'#26b78e'},{id:'B20',hex:'#cbeccf'},{id:'B21',hex:'#18616a'},{id:'B22',hex:'#0a4241'},{id:'B23',hex:'#343b1a'},{id:'B24',hex:'#e8faa6'},{id:'B25',hex:'#4e846d'},{id:'B26',hex:'#907c35'},{id:'B27',hex:'#d0e0af'},{id:'B28',hex:'#9ee5bb'},{id:'B29',hex:'#c6df5f'},{id:'B30',hex:'#e3fbb1'},{id:'B31',hex:'#b4e691'},{id:'B32',hex:'#92ad60'},
        {id:'C1',hex:'#f0fee4'},{id:'C2',hex:'#abf8fe'},{id:'C3',hex:'#a2e0f7'},{id:'C4',hex:'#44cdfb'},{id:'C5',hex:'#06aadf'},{id:'C6',hex:'#54a7e9'},{id:'C7',hex:'#3977ca'},{id:'C8',hex:'#0f52bd'},{id:'C9',hex:'#3349c3'},{id:'C10',hex:'#3cbce3'},{id:'C11',hex:'#2aded3'},{id:'C12',hex:'#1e334e'},{id:'C13',hex:'#cde7fe'},{id:'C14',hex:'#d5fcf7'},{id:'C15',hex:'#21c5c4'},{id:'C16',hex:'#1858a2'},{id:'C17',hex:'#02d1f3'},{id:'C18',hex:'#213244'},{id:'C19',hex:'#18869d'},{id:'C20',hex:'#1a70a9'},{id:'C21',hex:'#bcddfc'},{id:'C22',hex:'#6bb1bb'},{id:'C23',hex:'#c8e2fd'},{id:'C24',hex:'#7ec5f9'},{id:'C25',hex:'#a9e8e0'},{id:'C26',hex:'#42adcf'},{id:'C27',hex:'#d0def9'},{id:'C28',hex:'#bdcee8'},{id:'C29',hex:'#364a89'},
        {id:'D1',hex:'#acb7ef'},{id:'D2',hex:'#868dd3'},{id:'D3',hex:'#3554af'},{id:'D4',hex:'#162d7b'},{id:'D5',hex:'#b34ec6'},{id:'D6',hex:'#b37bdc'},{id:'D7',hex:'#8758a9'},{id:'D8',hex:'#e3d2fe'},{id:'D9',hex:'#d5b9f4'},{id:'D10',hex:'#301a49'},{id:'D11',hex:'#beb9e2'},{id:'D12',hex:'#dc99ce'},{id:'D13',hex:'#b5038d'},{id:'D14',hex:'#862993'},{id:'D15',hex:'#2f1f8c'},{id:'D16',hex:'#e2e4f0'},{id:'D17',hex:'#c7d3f9'},{id:'D18',hex:'#9a64b8'},{id:'D19',hex:'#d8c2d9'},{id:'D20',hex:'#9a35ad'},{id:'D21',hex:'#940595'},{id:'D22',hex:'#333a95'},{id:'D23',hex:'#eadbf8'},{id:'D24',hex:'#768ae1'},{id:'D25',hex:'#4950c2'},{id:'D26',hex:'#d6c6eb'},
        {id:'E1',hex:'#f6d4cb'},{id:'E2',hex:'#fcc1dd'},{id:'E3',hex:'#f6bde8'},{id:'E4',hex:'#e8649e'},{id:'E5',hex:'#f0569f'},{id:'E6',hex:'#eb4172'},{id:'E7',hex:'#c53674'},{id:'E8',hex:'#fddbe9'},{id:'E9',hex:'#e376c7'},{id:'E10',hex:'#d13b95'},{id:'E11',hex:'#f7dad4'},{id:'E12',hex:'#f693bf'},{id:'E13',hex:'#b5026a'},{id:'E14',hex:'#fad4bf'},{id:'E15',hex:'#f5c9ca'},{id:'E16',hex:'#fbf4ec'},{id:'E17',hex:'#f7e3ec'},{id:'E18',hex:'#f9c8db'},{id:'E19',hex:'#f6bbd1'},{id:'E20',hex:'#d7c6ce'},{id:'E21',hex:'#c09da4'},{id:'E22',hex:'#b38c9f'},{id:'E23',hex:'#937d8a'},{id:'E24',hex:'#debee5'},
        {id:'F1',hex:'#fe9381'},{id:'F2',hex:'#f63d4b'},{id:'F3',hex:'#ee4e3e'},{id:'F4',hex:'#fb2a40'},{id:'F5',hex:'#e10328'},{id:'F6',hex:'#913635'},{id:'F7',hex:'#911932'},{id:'F8',hex:'#bb0126'},{id:'F9',hex:'#e0677a'},{id:'F10',hex:'#874628'},{id:'F11',hex:'#592323'},{id:'F12',hex:'#f3536b'},{id:'F13',hex:'#f45c45'},{id:'F14',hex:'#fcadb2'},{id:'F15',hex:'#d50527'},{id:'F16',hex:'#f8c0a9'},{id:'F17',hex:'#e89b7d'},{id:'F18',hex:'#d07f4a'},{id:'F19',hex:'#be454a'},{id:'F20',hex:'#c69495'},{id:'F21',hex:'#f2b8c6'},{id:'F22',hex:'#f7c3d0'},{id:'F23',hex:'#ed806c'},{id:'F24',hex:'#e09daf'},{id:'F25',hex:'#e84854'},
        {id:'G1',hex:'#ffe4d3'},{id:'G2',hex:'#fcc6ac'},{id:'G3',hex:'#f1c4a5'},{id:'G4',hex:'#dcb387'},{id:'G5',hex:'#e7b34e'},{id:'G6',hex:'#e3a014'},{id:'G7',hex:'#985c3a'},{id:'G8',hex:'#713d2f'},{id:'G9',hex:'#e4b685'},{id:'G10',hex:'#da8c42'},{id:'G11',hex:'#dac898'},{id:'G12',hex:'#fec993'},{id:'G13',hex:'#b2714b'},{id:'G14',hex:'#8b684c'},{id:'G15',hex:'#f6f8e3'},{id:'G16',hex:'#f2d8c1'},{id:'G17',hex:'#77544e'},{id:'G18',hex:'#ffe3d5'},{id:'G19',hex:'#dd7d41'},{id:'G20',hex:'#a5452f'},{id:'G21',hex:'#b38561'},
        {id:'H1',hex:'#ffffff'},{id:'H2',hex:'#fbfbfb'},{id:'H3',hex:'#b4b4b4'},{id:'H4',hex:'#878787'},{id:'H5',hex:'#464646'},{id:'H6',hex:'#2c2c2c'},{id:'H7',hex:'#010101'},{id:'H8',hex:'#e7d6dc'},{id:'H9',hex:'#efedee'},{id:'H10',hex:'#ebebeb'},{id:'H11',hex:'#cdcdcd'},{id:'H12',hex:'#fdf6ee'},{id:'H13',hex:'#f4efd1'},{id:'H14',hex:'#ced7d4'},{id:'H15',hex:'#9aa6a6'},{id:'H16',hex:'#1b1213'},{id:'H17',hex:'#f0eeef'},{id:'H18',hex:'#fcfff6'},{id:'H19',hex:'#f2eee5'},{id:'H20',hex:'#96a09f'},{id:'H21',hex:'#f8fbe6'},{id:'H22',hex:'#cacad2'},{id:'H23',hex:'#9b9c94'},
        {id:'M1',hex:'#bbc6b6'},{id:'M2',hex:'#909994'},{id:'M3',hex:'#697e81'},{id:'M4',hex:'#e0d4bc'},{id:'M5',hex:'#d1ccaf'},{id:'M6',hex:'#b0aa86'},{id:'M7',hex:'#b0a796'},{id:'M8',hex:'#ae8082'},{id:'M9',hex:'#a68862'},{id:'M10',hex:'#c4b3bb'},{id:'M11',hex:'#9d7693'},{id:'M12',hex:'#644b51'},{id:'M13',hex:'#c79266'},{id:'M14',hex:'#c27563'},{id:'M15',hex:'#747d7a'},
        // P系列 (珠光)
        {id:'P1',hex:'#F9F9F9'},{id:'P2',hex:'#ABABAB'},{id:'P3',hex:'#B6DBAF'},{id:'P4',hex:'#FEA2A3'},{id:'P5',hex:'#EB903F'},{id:'P6',hex:'#63CEA2'},{id:'P7',hex:'#E79273'},{id:'P8',hex:'#ECDB59'},{id:'P9',hex:'#DBD9DA'},{id:'P10',hex:'#DBC7EA'},{id:'P11',hex:'#F1E9D4'},{id:'P12',hex:'#E9EDEE'},{id:'P13',hex:'#ADCBF1'},{id:'P14',hex:'#337BAD'},{id:'P15',hex:'#668575'},{id:'P16',hex:'#FDC24E'},{id:'P17',hex:'#FDA42E'},{id:'P18',hex:'#FEBDA7'},{id:'P19',hex:'#FFDEE9'},{id:'P20',hex:'#FCBFD1'},{id:'P21',hex:'#E8BEC2'},{id:'P22',hex:'#DFAAA4'},{id:'P23',hex:'#A3656A'},
        // Q系列 (温变)
        {id:'Q1',hex:'#F2A5E8'},{id:'Q2',hex:'#E9EC91'},{id:'Q3',hex:'#FFFF00'},{id:'Q4',hex:'#FFEBFA'},{id:'Q5',hex:'#76CEDE'},
        // R系列 (透明果冻水晶)
        {id:'R1',hex:'#D40E1F'},{id:'R2',hex:'#F13484'},{id:'R3',hex:'#FB852B'},{id:'R4',hex:'#F8ED33'},{id:'R5',hex:'#32C958'},{id:'R6',hex:'#1EBA93'},{id:'R7',hex:'#1D779C'},{id:'R8',hex:'#1960C8'},{id:'R9',hex:'#945AB1'},{id:'R10',hex:'#F8DA54'},{id:'R11',hex:'#FCECF7'},{id:'R12',hex:'#D8D4D3'},{id:'R13',hex:'#56534E'},{id:'R14',hex:'#A3E7DC'},{id:'R15',hex:'#78CEE7'},{id:'R16',hex:'#3FCDCE'},{id:'R17',hex:'#4E8379'},{id:'R18',hex:'#7DCA9C'},{id:'R19',hex:'#C8E664'},{id:'R20',hex:'#E3CCBA'},{id:'R21',hex:'#A17140'},{id:'R22',hex:'#6B372C'},{id:'R23',hex:'#F6BB6F'},{id:'R24',hex:'#F3C6C0'},{id:'R25',hex:'#C76A62'},{id:'R26',hex:'#D093BC'},{id:'R27',hex:'#E58EAE'},{id:'R28',hex:'#9F85CF'},
        // T系列 (透明)
        {id:'T1',hex:'#FCFDFF'},
        // Y系列 (夜光)
        {id:'Y1',hex:'#FF6FB7'},{id:'Y2',hex:'#FDB583'},{id:'Y3',hex:'#D8FCA4'},{id:'Y4',hex:'#91DAFB'},{id:'Y5',hex:'#E987EA'},{id:'Y6',hex:'#F7D4B8'},{id:'Y7',hex:'#F1FA7D'},{id:'Y8',hex:'#5EE88C'},{id:'Y9',hex:'#F8F5FE'},
        // ZG系列 (光变)
        {id:'ZG1',hex:'#DAABB3'},{id:'ZG2',hex:'#D6AA87'},{id:'ZG3',hex:'#C1BD8D'},{id:'ZG4',hex:'#96B69F'},{id:'ZG5',hex:'#849DC6'},{id:'ZG6',hex:'#94BFE2'},{id:'ZG7',hex:'#E2A9D2'},{id:'ZG8',hex:'#AB91C0'}
    ];

    let data = JSON.parse(localStorage.getItem('bead_v_sort')) || MARD_DB.map(i => ({...i, w: 0, totalUsed: 0, logs: [], monitor: true}));
    
    // 同步新色号：检查 MARD_DB 中是否有新色号未在 data 中
    MARD_DB.forEach(dbItem => {
        let existing = data.find(d => d.id === dbItem.id);
        if (!existing) {
            data.push({...dbItem, w: 0, totalUsed: 0, logs: [], monitor: true});
        } else {
            // 修复：强制更新色值，解决旧数据颜色错误问题
            if(dbItem.hex) existing.hex = dbItem.hex;
            // 确保旧数据也有 monitor 字段
            if(existing.monitor === undefined) existing.monitor = true;
        }
    });

    let threshold = parseFloat(localStorage.getItem('bead_threshold')) || 5;
    // document.getElementById('threshold').value = threshold; 
    let sel = new Set();
    let selectedSeries = new Set(); // New series filter
    let currentEditId = null;
    let currentModelEditMode = 'add'; // 'add' or 'rename'
    let currentModelOldName = '';
    let currentModelToDelete = null;
    let currentRevertPlanId = null;
    let currentDeletePlanId = null;
    let currentMoveOutPlanId = null;
    let pendingMergePlans = null; // Store plans to be merged while waiting for name input
    let beadSortField = 'id';
    let beadSortOrder = 'asc';