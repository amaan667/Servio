
import java.io.File;

import javax.swing.JFileChooser;
import javax.swing.filechooser.FileSystemView;
import javax.swing.filechooser.FileNameExtensionFilter;

public class FileSave {

    public FileSave()
    {
        createSave();
    }

    public void createSave()
    {
        JFileChooser save = new JFileChooser(FileSystemView.getFileSystemView().getHomeDirectory());
        save.setDialogTitle("Save File");

        int returnValue = save.showDialog(null, "Save");
        if (returnValue == JFileChooser.APPROVE_OPTION) {
            System.out.println(save.getSelectedFile().getPath());
        }

    }
}
