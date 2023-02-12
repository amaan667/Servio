import java.io.File;
import java.awt.Desktop;
import java.io.FileNotFoundException;
import java.io.IOException;
import javax.swing.JFileChooser;
import javax.swing.filechooser.FileSystemView;
import javax.swing.filechooser.FileNameExtensionFilter;

public class FileLoad {

    public FileLoad()
    {
        createManager();
    }

    public void createManager()
    {
        JFileChooser load = new JFileChooser(FileSystemView.getFileSystemView().getHomeDirectory());
        load.setDialogTitle("Load File");
        load.setAcceptAllFileFilterUsed(false);
        FileNameExtensionFilter filter = new FileNameExtensionFilter("PNG and JPG images", "png", "jpeg");
        load.addChoosableFileFilter(filter);

        int returnValue = load.showOpenDialog(null);
        if (returnValue == JFileChooser.APPROVE_OPTION) {
            try {
                File file = load.getSelectedFile();
                Desktop.getDesktop().open(file);
            }catch(IOException ex){
                System.err.print("ERROR: File containing _______ information not found:\n");
                ex.printStackTrace();
                System.exit(1);
            }
        }

        // if (load.showOpenDialog(modalToComponent) == load.APPROVE_OPTION) {
        //     File file = load.getSelectedFile();
    }
}
