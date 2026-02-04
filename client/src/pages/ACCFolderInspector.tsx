import { useState } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Folder, FileText } from 'lucide-react';

export default function ACCFolderInspector() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  
  const { data, isLoading, refetch } = trpc.acc.inspectFolderStructure.useQuery({
    projectId,
    folderId: currentFolderId,
  });
  
  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }
  
  if (!data) {
    return <div className="p-8">No data</div>;
  }
  
  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">ACC Folder Inspector</h1>
        <p className="text-muted-foreground">
          Inspect folder structure and allowed types in your ACC project
        </p>
      </div>
      
      {currentFolderId && (
        <Button
          variant="outline"
          onClick={() => setCurrentFolderId(undefined)}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Root
        </Button>
      )}
      
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Current Folder</h2>
        <div className="space-y-2">
          <div><strong>Name:</strong> {data.folder.name}</div>
          <div><strong>ID:</strong> <code className="text-sm bg-muted px-2 py-1 rounded">{data.folder.id}</code></div>
          <div><strong>Type:</strong> <code className="text-sm bg-muted px-2 py-1 rounded">{data.folder.type}</code></div>
          <div>
            <strong>Allowed Types:</strong>
            {data.folder.allowedTypes.length > 0 ? (
              <ul className="list-disc list-inside mt-2">
                {data.folder.allowedTypes.map((type: string) => (
                  <li key={type}>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{type}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground ml-2">None specified</span>
            )}
          </div>
        </div>
      </Card>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Contents</h2>
        <div className="space-y-2">
          {data.contents.length === 0 ? (
            <p className="text-muted-foreground">Empty folder</p>
          ) : (
            data.contents.map((item: any) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 border rounded hover:bg-muted/50 transition-colors"
              >
                {item.type === 'folders' ? (
                  <Folder className="w-5 h-5 text-blue-500 mt-0.5" />
                ) : (
                  <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Type: <code className="text-xs bg-muted px-1 py-0.5 rounded">{item.extensionType}</code>
                  </div>
                  {item.allowedTypes.length > 0 && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Allowed: {item.allowedTypes.map((t: string) => (
                        <code key={t} className="text-xs bg-muted px-1 py-0.5 rounded mr-1">{t}</code>
                      ))}
                    </div>
                  )}
                </div>
                {item.type === 'folders' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentFolderId(item.id)}
                  >
                    Inspect
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
