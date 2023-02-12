package EventSystem;

import java.awt.event.ActionListener;

public interface ActionListenerWithDataPackage extends ActionListener {
    public void notifyListener(Object sourceObject, Object dataPackage);
}
