const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('description.md', 'utf-8');
const lines = content.split('\n');

let currentFolder = 'general';
let currentFile = 'introduction';
let currentContent = [];

function sanitizeName(name) {
    return name
        .replace(/[^\w\s-]/g, '') // remove special chars and emojis
        .trim()
        .replace(/\s+/g, '-') // spaces to dashes
        .toLowerCase();
}

function saveCurrentFile() {
    if (currentFolder && currentFile && currentContent.length > 0) {
        const folderPath = path.join(__dirname, 'docs', currentFolder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        const filePath = path.join(folderPath, `${currentFile}.md`);
        
        let fileText = currentContent.join('\n').trim();
        if (fileText.startsWith('### ')) {
            let title = fileText.split('\n')[0].substring(4).replace('☑', '').trim();
            fileText = '# ' + title + '\n\n' + fileText.substring(fileText.indexOf('\n') + 1).trim();
        }
        
        fs.writeFileSync(filePath, fileText);
        console.log(`Created ${filePath}`);
    }
}

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('## ') && !line.startsWith('### ')) {
        saveCurrentFile();
        
        let folderNameRaw = line.substring(3);
        currentFolder = sanitizeName(folderNameRaw);
        currentFile = '';
        currentContent = [];
        
        const folderPath = path.join(__dirname, 'docs', currentFolder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        fs.writeFileSync(path.join(folderPath, 'README.md'), '# ' + folderNameRaw.replace(/[^a-zA-Z0-9 &|-]/g, '').trim() + '\n');
        
        continue;
    }
    
    if (line.startsWith('### ')) {
        saveCurrentFile();
        
        let fileNameRaw = line.substring(4).replace('☑', '').trim();
        currentFile = sanitizeName(fileNameRaw);
        currentContent = [line];
        continue;
    }
    
    currentContent.push(line);
}

saveCurrentFile();
console.log('Breakdown complete.');
